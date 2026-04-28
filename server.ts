import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { setupGmailRoutes } from "./serverGmail.js";
import { GoogleGenAI, Type } from "@google/genai";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { ComparisonDataSchema, SaveComparisonSchema } from "./src/schemas.ts";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
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

  setupGmailRoutes(app);

  app.post("/api/extract", extractLimiter, async (req, res) => {
    try {
      const { input, files, provider = 'groq' } = req.body;
      
      const prompt = `Extract quotation details from the following information and structure it for a comparison table. 
      
      CRITICAL INSTRUCTION FOR GST STATUS:
      You must intelligently determine if the quoted prices are "Inclusive" or "Exclusive" of GST.
      - Set to "Inclusive" if you see: "All Inclusive", "Incl. GST", "GST Paid", "Net Rate", "Inclusive of all taxes", "VAT Included", or if the total amount matches a calculation where GST is already added.
      - Set to "Exclusive" if you see: "GST Extra", "Taxes Extra", "+ GST", "GST @ 18%", "Plus Taxes", "Excluding GST", or if the quote specifically lists GST as a separate line item to be added.
      - Default to "Exclusive" if it's ambiguous, but look for contextual clues like "Prices are ex-works" (often implies taxes extra).
      - If multiple items have different statuses, use the most common one or the one stated in general terms.

      Other fields to extract:
      - Delivery Period: Time required for delivery.
      - Freight: Transportation charges.
      - Packing & Forwarding (P&F): Extract exact % or value.
      - Ready Stock: Yes/No.
      - Other Extra: Special terms.
      
      Format the output as JSON according to the schema.`;

      let parsed: any;

      if (provider === 'groq') {
        const groqApiKey = process.env.GROQ_API_KEY;
        const groqModel = process.env.GROQ_MODEL || "llama3-70b-8192";
        
        if (!groqApiKey) {
          throw new Error("Groq API key not configured");
        }

        let fullText = input || "";
        if (files && files.length > 0) {
          fullText += "\n\n[Note: Files were uploaded but Groq might have limited vision support. Using text input.]\n";
          // If we had a text extraction service for PDFs/Images, we'd use it here.
          // For now, we rely on the input text if provider is Groq and it's not a vision model.
        }

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              { role: "system", content: "You are a helpful assistant that extracts quotation data into structured JSON. Always return ONLY valid JSON." },
              { role: "user", content: `${prompt}\n\nInput Information:\n${fullText}` }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (!groqResponse.ok) {
          const error = await groqResponse.json();
          throw new Error(`Groq API error: ${JSON.stringify(error)}`);
        }

        const groqData = await groqResponse.json();
        parsed = JSON.parse(groqData.choices[0].message.content);
      } else {
        // Default to Gemini
        const model = "gemini-flash-latest";
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
        parsed = JSON.parse(cleanedText);
      }
      
      // Zod Validation for AI output
      const validated = ComparisonDataSchema.parse(parsed);
      res.json(validated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/comparisons", authenticateToken, async (req, res) => {
    try {
      const validated = SaveComparisonSchema.parse(req.body);
      const comparison = await prisma.comparison.upsert({
        where: { doc_no: validated.doc_no },
        update: { data: validated.data as any, created_at: new Date() },
        create: { doc_no: validated.doc_no, data: validated.data as any },
      });
      res.json({ success: true, comparison });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/comparisons", authenticateToken, async (req, res) => {
    try {
      const comparisons = await prisma.comparison.findMany({
        orderBy: { created_at: "desc" },
        select: { id: true, doc_no: true, created_at: true, data: true },
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
      const validated = SaveComparisonSchema.parse(req.body);
      const comparison = await prisma.comparison.update({
        where: { id: parseInt(req.params.id) },
        data: { 
          doc_no: validated.doc_no,
          data: validated.data as any,
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
