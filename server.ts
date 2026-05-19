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

import OpenAI from "openai";
import pdf from "pdf-extraction";

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

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text || "[No text found]";
  } catch (err) {
    console.error("PDF Parse Error:", err);
    return "[Error parsing PDF]";
  }
}

async function startServer() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
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
      const { input, files, userPrompt } = req.body;
      console.log(`[AI] Extraction requested. Files: ${files?.length || 0}, Text: ${input ? 'Yes' : 'No'}, User Prompt: ${userPrompt ? 'Yes' : 'No'}`);

      const isTextOnly = (!files || files.length === 0) && input && input.trim().length > 0;

      const prompt = `You are an expert procurement assistant specializing in high-precision data extraction.

      ${userPrompt ? `USER SPECIFIC INSTRUCTIONS (HIGH PRIORITY):
      ${userPrompt}
      ` : ""}

      DATA SOURCES:
      ${files && files.length > 0 ? "1. Attached Files (PDFs/Images): These contain the primary quotation documents." : ""}
      ${input ? `2. Input Text: ${isTextOnly ? "THIS IS THE ONLY SOURCE. Extract everything from this text." : "Additional notes or pasted quotation data."}` : ""}

      CRITICAL INSTRUCTIONS:
      - Analyze the provided data sources carefully.
      ${userPrompt ? `- ADHERE STRICTLY to the "USER SPECIFIC INSTRUCTIONS" provided above.` : ""}
      ${isTextOnly ? "- Since this is TEXT-ONLY input, do NOT hallucinate or 'invent' any data. If a field (like MRP or Discount) is not explicitly mentioned, leave it as 0." : "- Find every Vendor Name and every Item mentioned across all sources."}
      - For each item, extract: Description, UOM, QTY, and any Previous Price if mentioned.
      - For each vendor's quote on an item, extract: Make, MRP, Discount (as percentage, e.g., 10 for 10%), Net Rate, and Quote Date.      
      VENDOR IDENTIFICATION:
      - If you cannot find a clear Vendor Name for a piece of data, use "Unknown Vendor" instead of guessing.
      - Group items by the vendor they belong to.

      CRITICAL INSTRUCTION FOR PRICE PRECISION:
      - All extracted numerical values (MRP, Discount, Net Rate, Total Amount, Previous Price Rate) MUST be numbers (not strings).
      - Discount MUST be extracted as a percentage (e.g., if a 10% discount is mentioned, return 10).
      - Round all numerical values to exactly 2 decimal places.
      - If a value is missing or unclear, use 0.
      
      STRICT JSON OUTPUT:
      - Return ONLY a valid JSON object. 
      - If no valid quotation data is found, return {"vendors": [], "items": []}.

      JSON STRUCTURE:
      {
        "vendors": ["Vendor Name"],
        "items": [
          {
            "description": "Item Name",
            "uom": "PCS",
            "qty": 1,
            "weight": 0,
            "previousPrice": { "rate": 0, "date": "", "vendor": "" },
            "vendorQuotes": [
              {
                "vendorName": "Vendor Name",
                "make": "",
                "mrp": 0,
                "discount": 0,
                "netRate": 0,
                "totalAmount": 0,
                "deliveryPeriod": "",
                "readyStock": "",
                "gstStatus": "18% Extra", // "18% Extra", "5% Extra", or "Inclusive"
                "extra": "",
                "quoteDate": ""
              }
            ]
          }
        ]
      }`;

      // Helper to process with OpenAI
      const callOpenAI = async (model: string) => {
        console.log(`[AI] Attempting extraction with ${model}...`);
        
        let pdfText = "";
        const pdfFiles = files?.filter((f: any) => f.mimeType === "application/pdf") || [];
        for (const f of pdfFiles) {
          const text = await extractTextFromPDF(Buffer.from(f.data, 'base64'));
          pdfText += `\nFILE CONTENT (${f.name || 'PDF'}):\n${text}\n`;
        }

        const messages: any[] = [
          { role: "system", content: "You are a precise procurement data extractor. You only output valid JSON." },
          { role: "user", content: [
            { type: "text", text: prompt },
            ...(input ? [{ type: "text", text: `SOURCE TEXT:\n${input}` }] : []),
            ...(pdfText ? [{ type: "text", text: `PDF SOURCE DATA:\n${pdfText}` }] : []),
            ...(files?.filter((f: any) => f.mimeType.startsWith("image/")).map((f: any) => ({
              type: "image_url",
              image_url: { url: `data:${f.mimeType};base64,${f.data}` }
            })) || [])
          ]}
        ];

        const response = await openai.chat.completions.create({
          model,
          messages,
          response_format: { type: "json_object" },
          temperature: 0,
        });

        const rawResult = response.choices[0].message.content || "{}";
        const parsed = JSON.parse(rawResult);
        return ComparisonDataSchema.parse(parsed);
      };

      // 1. GPT-4o-mini (Primary)
      if (process.env.OPENAI_API_KEY) {
        try {
          const result = await callOpenAI("gpt-4o-mini");
          console.log("[AI] GPT-4o-mini successful.");
          return res.json(result);
        } catch (err: any) {
          console.error("[AI] GPT-4o-mini failed:", err.message || err);
        }

        // 2. GPT-4o (Fallback 1)
        try {
          const result = await callOpenAI("gpt-4o");
          console.log("[AI] GPT-4o successful.");
          return res.json(result);
        } catch (err: any) {
          console.error("[AI] GPT-4o failed:", err.message || err);
        }
      }

      // 3. Gemini (Fallback - Native File Processing)
      console.log("[AI] Attempting extraction with Gemini (Fallback)...");
      const modelName = "gemini-1.5-flash"; // Fixed model name
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...(files?.map((f: any) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })) || []),
              ...(input && input.trim() ? [{ text: `SOURCE TEXT:\n${input}` }] : [])
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              vendors: { type: "array", items: { type: "string" } },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    indentNo: { type: "string" },
                    siNo: { type: "string" },
                    description: { type: "string" },
                    uom: { type: "string" },
                    qty: { type: "number" },
                    weight: { type: "number" },
                    previousPrice: {
                      type: "object",
                      properties: {
                        rate: { type: "number" },
                        date: { type: "string" }
                      }
                    },
                    vendorQuotes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          vendorName: { type: "string" },
                          make: { type: "string" },
                          mrp: { type: "number" },
                          discount: { type: "number" },
                          netRate: { type: "number" },
                          totalAmount: { type: "number" },
                          deliveryPeriod: { type: "string" },
                          readyStock: { type: "string" },
                          gstStatus: { type: "string" },
                          extra: { type: "string" },
                          quoteDate: { type: "string" }
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
      const validated = ComparisonDataSchema.parse(parsed);
      console.log("[AI] Gemini successful.");
      res.json(validated);

    } catch (err: any) {
      console.error("[AI] All extraction attempts failed:", err);
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

  // --- PO Maker API ---

  // Company Settings
  app.get("/api/settings/company", authenticateToken, async (req, res) => {
    try {
      let settings = await prisma.companySettings.findFirst();
      if (!settings) {
        settings = await prisma.companySettings.create({ 
          data: { 
            id: 1, 
            name: "HEMRAJ INDUSTRIES PRIVATE LIMITED",
            cin: "U01111WB1991PTC051314",
            gstin: "19AAACH8249K1Z4",
            pan: "AAACH8249K",
            email: "purchase@hemrajgroup.co.in",
            phone: "+91 33 2229 8038 / 4064 9316",
            website: "www.hemrajgroup.co.in",
            regd_office: "46B Rafi Ahmed Kidwai Road, 1st Floor, Kolkata-700 016",
            factory_address: "Vill. P.O. Chandul, G.T. Road, Burdwan (W.B.) Pin : 713141"
          } 
        });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings/company", authenticateToken, async (req, res) => {
    try {
      const settings = await prisma.companySettings.upsert({
        where: { id: 1 },
        update: req.body,
        create: { ...req.body, id: 1 },
      });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Terms Templates
  app.get("/api/settings/terms", authenticateToken, async (req, res) => {
    try {
      const templates = await prisma.termsTemplate.findMany();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/settings/terms", authenticateToken, async (req, res) => {
    try {
      const template = await prisma.termsTemplate.create({ data: req.body });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.delete("/api/settings/terms/:id", authenticateToken, async (req, res) => {
    try {
      await prisma.termsTemplate.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Vendors
  app.get("/api/settings/vendors", authenticateToken, async (req, res) => {
    try {
      const vendors = await prisma.vendorMaster.findMany({
        orderBy: { name: "asc" },
      });
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.post("/api/settings/vendors", authenticateToken, async (req, res) => {
    try {
      const vendor = await prisma.vendorMaster.create({ data: req.body });
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ error: "Failed to create vendor" });
    }
  });

  app.delete("/api/settings/vendors/:id", authenticateToken, async (req, res) => {
    try {
      await prisma.vendorMaster.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vendor" });
    }
  });

  // Purchase Orders
  app.get("/api/po", authenticateToken, async (req, res) => {
    try {
      const pos = await prisma.purchaseOrder.findMany({
        orderBy: { created_at: "desc" },
        take: 50
      });
      res.json(pos);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch POs" });
    }
  });

  app.post("/api/po", authenticateToken, async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.date) data.date = new Date(data.date);
      const po = await prisma.purchaseOrder.create({ data });
      res.json(po);
    } catch (error) {
      console.error("[Backend] PO Save Error:", error);
      res.status(500).json({ error: "Failed to save PO", details: String(error) });
    }
  });

  app.get("/api/po/:id", authenticateToken, async (req, res) => {
    try {
      const po = await prisma.purchaseOrder.findUnique({ where: { id: Number(req.params.id) } });
      if (!po) return res.status(404).json({ error: "PO not found" });
      res.json(po);
    } catch (error) {
      console.error("[Backend] PO Fetch Error:", error);
      res.status(500).json({ error: "Failed to fetch PO" });
    }
  });

  app.put("/api/po/:id", authenticateToken, async (req, res) => {
    try {
      // Remove id from body to avoid primary key update attempt
      const { id, created_at, ...data } = req.body;
      if (data.date) data.date = new Date(data.date);
      const po = await prisma.purchaseOrder.update({
        where: { id: Number(req.params.id) },
        data
      });
      res.json(po);
    } catch (error) {
      console.error("[Backend] PO Update Error:", error);
      res.status(500).json({ error: "Failed to update PO", details: String(error) });
    }
  });

  app.delete("/api/po/:id", authenticateToken, async (req, res) => {
    try {
      await prisma.purchaseOrder.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete PO" });
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
