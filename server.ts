import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { ComparisonDataSchema, SaveComparisonSchema } from "./src/schemas.ts";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("neon.tech") || process.env.DATABASE_URL?.includes("render.com") 
    ? { rejectUnauthorized: false } 
    : false
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const JWT_SECRET = process.env.JWT_SECRET || "quotecompare-default-secret-2026";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Rate Limiters
const extractLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 extraction requests per window
  message: { error: "Too many extraction requests. Please try again later." }
});

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 login attempts per hour
  message: { error: "Too many login attempts. Please try again later." }
});

async function startServer() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // JWT Middleware
  const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Access denied. Token missing." });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Invalid token." });
      (req as any).user = user;
      next();
    });
  };

  // Auth Route
  app.post("/api/login", loginLimiter, (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
      return res.json({ token });
    }
    res.status(401).json({ error: "Invalid password" });
  });

  app.post("/api/extract", extractLimiter, async (req, res) => {
    try {
      const { input, files } = req.body;
      console.log(`[AI] Extraction requested. Files: ${files?.length || 0}, Text: ${input ? 'Yes' : 'No'}`);
      
      const prompt = `You are an expert procurement assistant. Your task is to extract all quotation details from the provided data. 
      
      DATA SOURCES:
      1. Attached Files (PDFs/Images): These contain the primary quotation documents. You MUST carefully scan every page/image.
      2. Input Text: Additional notes or pasted quotation data.
      
      CRITICAL INSTRUCTIONS:
      - Analyze BOTH the attached files and the input text.
      - Find every Vendor Name and every Item mentioned.
      - For each item, extract: Description, UOM, QTY, and any Previous Price if mentioned.
      - For each vendor's quote on an item, extract: Make, MRP, Discount, and Net Rate.
      
      CRITICAL INSTRUCTION FOR STEEL ITEMS & WEIGHT:
      If an item is a steel item (e.g., TMT bars, plates, beams, etc.) and a weight (in kg, MT, or tons) is mentioned, you MUST extract it.
      - Set the "weight" field to the numerical weight value.
      - If weight is mentioned, calculate totalAmount as (Net Rate * Weight).
      - If NOT mentioned, calculate totalAmount as (Net Rate * QTY).

      CRITICAL INSTRUCTION FOR GST STATUS:
      Intelligently determine if quoted prices are "Inclusive" or "Exclusive" of GST.
      - "Inclusive" if you see: "All Inclusive", "Incl. GST", "GST Paid", "Net Rate", "Inclusive of all taxes".
      - "Exclusive" if you see: "GST Extra", "Taxes Extra", "+ GST", "GST @ 18%", "Excluding GST".
      - Default to "Exclusive" if ambiguous.

      Format the output as JSON according to the schema. Always return valid JSON only.`;

      const model = "gemini-2.5-flash";
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              { text: prompt },
              ...(files?.map((f: any) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })) || []),
              ...(input && input.trim() ? [{ text: input }] : [])
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vendors: { type: Type.ARRAY, items: { type: Type.STRING } },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    indentNo: { type: Type.STRING },
                    siNo: { type: Type.STRING },
                    description: { type: Type.STRING },
                    uom: { type: Type.STRING },
                    qty: { type: Type.NUMBER },
                    weight: { type: Type.NUMBER },
                    previousPrice: {
                      type: Type.OBJECT,
                      properties: {
                        rate: { type: Type.NUMBER },
                        date: { type: Type.STRING }
                      }
                    },
                    vendorQuotes: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          vendorName: { type: Type.STRING },
                          make: { type: Type.STRING },
                          mrp: { type: Type.NUMBER },
                          discount: { type: Type.NUMBER },
                          netRate: { type: Type.NUMBER },
                          totalAmount: { type: Type.NUMBER },
                          deliveryPeriod: { type: Type.STRING },
                          readyStock: { type: Type.STRING },
                          packingAndForwarding: { type: Type.STRING },
                          freight: { type: Type.STRING },
                          gstStatus: { type: Type.STRING },
                          extra: { type: Type.STRING }
                        }
                      }
                    }
                  }
                }
              }
            },
            required: ["vendors", "items"]
          }
        }
      });

      const rawText = response.text || "{}";
      const cleanedText = rawText.replace(/^\`\`\`json/m, '').replace(/^\`\`\`/m, '').trim();
      const parsed = JSON.parse(cleanedText);
      
      // Zod Validation for AI output
      const validated = ComparisonDataSchema.parse(parsed);
      res.json(validated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  // --- Master Data CRUD (Executives & Plants) ---
  
  app.get("/api/masters", authenticateToken, async (req, res) => {
    try {
      const [executives, plants] = await Promise.all([
        prisma.executive.findMany({ orderBy: { name: 'asc' } }),
        prisma.plant.findMany({ orderBy: { name: 'asc' } })
      ]);
      res.json({ executives, plants });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/executives", authenticateToken, async (req, res) => {
    try {
      const { name, designation } = req.body;
      const executive = await prisma.executive.create({ data: { name, designation } });
      res.json(executive);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/executives/:id", authenticateToken, async (req, res) => {
    try {
      await prisma.executive.delete({ where: { id: parseInt(req.params.id) } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/plants", authenticateToken, async (req, res) => {
    try {
      const { name, location } = req.body;
      const plant = await prisma.plant.create({ data: { name, location } });
      res.json(plant);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/plants/:id", authenticateToken, async (req, res) => {
    try {
      await prisma.plant.delete({ where: { id: parseInt(req.params.id) } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // --- Comparison CRUD ---

  app.post("/api/comparisons", authenticateToken, async (req, res) => {
    try {
      const { doc_no, data, executive_id, plant_id } = req.body;
      const comparison = await prisma.comparison.upsert({
        where: { doc_no },
        update: { 
          data: data as any, 
          executive_id: executive_id ? parseInt(executive_id) : null,
          plant_id: plant_id ? parseInt(plant_id) : null,
          created_at: new Date() 
        },
        create: { 
          doc_no, 
          data: data as any,
          executive_id: executive_id ? parseInt(executive_id) : null,
          plant_id: plant_id ? parseInt(plant_id) : null
        },
      });
      res.json({ success: true, comparison });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/comparisons/latest-year", authenticateToken, async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);

      const latest = await prisma.comparison.findFirst({
        where: {
          created_at: {
            gte: startOfYear,
            lte: endOfYear
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        select: {
          doc_no: true
        }
      });
      res.json({ latest: latest?.doc_no || null });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/comparisons", authenticateToken, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 25;
      const comparisons = await prisma.comparison.findMany({
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          executive: true,
          plant: true
        }
      });
      res.json(comparisons);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/comparisons/:id", authenticateToken, async (req, res) => {
    try {
      const comparison = await prisma.comparison.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { executive: true, plant: true }
      });
      if (!comparison) return res.status(404).json({ error: "Not found" });
      res.json(comparison);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/comparisons/:id", authenticateToken, async (req, res) => {
    try {
      const { doc_no, data, executive_id, plant_id } = req.body;
      const comparison = await prisma.comparison.update({
        where: { id: parseInt(req.params.id) },
        data: { 
          doc_no,
          data: data as any,
          executive_id: executive_id ? parseInt(executive_id) : null,
          plant_id: plant_id ? parseInt(plant_id) : null,
          created_at: new Date()
        },
      });
      return res.status(200).json({ success: true, comparison });
    } catch (err) {
      console.error("PUT Error:", err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/comparisons/:id", authenticateToken, async (req, res) => {
    try {
      await prisma.comparison.delete({
        where: { id: parseInt(req.params.id) },
      });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Gemini API Key Loaded: ${!!process.env.GEMINI_API_KEY ? "YES" : "NO"}`);
  });
}

startServer().catch(console.error);
