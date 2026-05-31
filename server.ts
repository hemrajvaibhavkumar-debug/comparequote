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
import bcrypt from "bcryptjs";
import { dbCache } from "./src/services/dbCache.ts";

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
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "",
    baseURL: "https://api.groq.com/openai/v1"
  });
  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

  // Auto-Seeder for SuperAdmin and Roles
  const seedDefaults = async (retries = 3) => {
    try {
      console.log(`[Auth] Attempting to seed defaults (Attempts remaining: ${retries})...`);
      
      // 1. Seed Roles
      const roleCount = await prisma.systemRole.count();
      if (roleCount === 0) {
        const defaultRoles = ['USER', 'PURCHASE_HEAD', 'SUPERADMIN', 'SR. EXECUTIVE'];
        await prisma.systemRole.createMany({
          data: defaultRoles.map(name => ({ name }))
        });
        console.log("[Auth] Default roles seeded");
      }

      // 2. Seed SuperAdmin
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await prisma.user.create({
          data: {
            username: 'admin',
            password: hashedPassword,
            role: 'SUPERADMIN',
            permissions: [
              "ACCESS_COMPARE", 
              "VIEW_SAVED_TABLES", 
              "ACCESS_PO_MAKER", 
              "VIEW_SAVED_POS", 
              "MANAGE_SETTINGS", 
              "MANAGE_USERS",
              "APPROVE_PO"
            ]
          }
        });
        console.log("[Auth] SuperAdmin account seeded: username 'admin'");
      }
    } catch (e: any) {
      console.error("[Auth] Seeder attempt failed:", e.message);
      if (e.meta) console.error("[Auth] Error meta:", JSON.stringify(e.meta, null, 2));
      
      if (retries > 0) {
        console.log("[Auth] Retrying in 2 seconds...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        return seedDefaults(retries - 1);
      }
      console.error("[Auth] All seeding attempts failed.");
    }
  };
  await seedDefaults();

  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // JWT Middleware (Enhanced for RBAC)
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

  const requirePermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (user.role === 'SUPERADMIN') return next();
      
      const permissions = user.permissions || [];
      if (permissions.includes(permission)) {
        return next();
      }
      res.status(403).json({ error: `Permission denied: ${permission}` });
    };
  };

  // Refactored Login Route
  app.post("/api/login", loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    try {
      // Compatibility for legacy password-only login (if user only sends password, assume admin)
      const targetUsername = username || 'admin';
      
      const user = await prisma.user.findUnique({ where: { username: targetUsername } });
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign({ 
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }, JWT_SECRET, { expiresIn: "24h" });
      
      return res.json({ token, role: user.role, permissions: user.permissions });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User Management API (SuperAdmin Only)
  app.get("/api/users", authenticateToken, requirePermission("MANAGE_USERS"), async (req, res) => {
    try {
      const cacheKey = "users:list";
      const cached = dbCache.get<any[]>(cacheKey);
      if (cached) return res.json(cached);

      const users = await prisma.user.findMany({
        select: { id: true, username: true, role: true, permissions: true, created_at: true }
      });
      dbCache.set(cacheKey, users);
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", authenticateToken, requirePermission("MANAGE_USERS"), async (req, res) => {
    try {
      const { username, password, role, permissions } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { username, password: hashedPassword, role, permissions }
      });
      dbCache.delete("users:list");
      res.json({ success: true, id: user.id });
    } catch (e) {
      res.status(500).json({ error: "Failed to create user. Username might be taken." });
    }
  });

  app.put("/api/users/:id", authenticateToken, requirePermission("MANAGE_USERS"), async (req, res) => {
    try {
      const { password, role, permissions } = req.body;
      const updateData: any = { role, permissions };
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      await prisma.user.update({
        where: { id: parseInt(req.params.id) },
        data: updateData
      });
      dbCache.delete("users:list");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", authenticateToken, requirePermission("MANAGE_USERS"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await prisma.user.findUnique({ where: { id } });
      if (user?.role === 'SUPERADMIN') return res.status(403).json({ error: "Cannot delete SuperAdmin" });
      
      await prisma.user.delete({ where: { id } });
      dbCache.delete("users:list");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete user" });
    }
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
      const modelName = "gemini-2.5-flash"; 
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
      const cacheKey = "masters:all";
      const cached = dbCache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const [executives, plants] = await Promise.all([
        prisma.executive.findMany({ orderBy: { name: 'asc' } }),
        prisma.plant.findMany({ orderBy: { name: 'asc' } })
      ]);
      const result = { executives, plants };
      dbCache.set(cacheKey, result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/executives", authenticateToken, async (req, res) => {
    try {
      const { name, designation } = req.body;
      const executive = await prisma.executive.create({ data: { name, designation } });
      dbCache.delete("masters:all");
      res.json(executive);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/executives/:id", authenticateToken, async (req, res) => {
    try {
      await prisma.executive.delete({ where: { id: parseInt(req.params.id) } });
      dbCache.delete("masters:all");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/plants", authenticateToken, async (req, res) => {
    try {
      const { name, location } = req.body;
      const plant = await prisma.plant.create({ data: { name, location } });
      dbCache.delete("masters:all");
      res.json(plant);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // --- PO Maker API ---

  // Company Settings
  app.get("/api/settings/company", authenticateToken, async (req, res) => {
    try {
      const cacheKey = "settings:company";
      const cached = dbCache.get<any>(cacheKey);
      if (cached) return res.json(cached);

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
      dbCache.set(cacheKey, settings);
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
      dbCache.delete("settings:company");
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Terms Templates
  app.get("/api/settings/terms", authenticateToken, async (req, res) => {
    try {
      const cacheKey = "settings:terms";
      const cached = dbCache.get<any[]>(cacheKey);
      if (cached) return res.json(cached);

      const templates = await prisma.termsTemplate.findMany();
      dbCache.set(cacheKey, templates);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/settings/terms", authenticateToken, async (req, res) => {
    try {
      const template = await prisma.termsTemplate.create({ data: req.body });
      dbCache.delete("settings:terms");
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.delete("/api/settings/terms/:id", authenticateToken, async (req, res) => {
    try {
      await prisma.termsTemplate.delete({ where: { id: Number(req.params.id) } });
      dbCache.delete("settings:terms");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Vendors
  app.get("/api/settings/vendors", authenticateToken, async (req, res) => {
    try {
      const cacheKey = "settings:vendors";
      const cached = dbCache.get<any[]>(cacheKey);
      if (cached) return res.json(cached);

      const vendors = await prisma.vendorMaster.findMany({
        orderBy: { name: "asc" },
      });
      dbCache.set(cacheKey, vendors);
      res.json(vendors);
    } catch (error) {
      console.error("[Backend] Vendor fetch error:", error);
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.post("/api/settings/vendors", authenticateToken, async (req, res) => {
    try {
      const vendor = await prisma.vendorMaster.upsert({
        where: { name: req.body.name },
        update: req.body,
        create: req.body,
      });
      dbCache.delete("settings:vendors");
      res.json(vendor);
    } catch (error) {
      console.error("[Backend] Vendor save error:", error);
      res.status(500).json({ error: "Failed to create vendor" });
    }
  });

  app.delete("/api/settings/vendors/:name", authenticateToken, async (req, res) => {
    try {
      await prisma.vendorMaster.delete({ where: { name: req.params.name } });
      dbCache.delete("settings:vendors");
      res.json({ success: true });
    } catch (error) {
      console.error("[Backend] Vendor delete error:", error);
      res.status(500).json({ error: "Failed to delete vendor" });
    }
  });

  // Bulk Item Extraction using Groq
  app.post("/api/extract-po-items", authenticateToken, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: "No text provided for extraction" });
      }

      console.log(`[AI] Bulk Item Extraction requested with Groq...`);

      const prompt = `You are an expert procurement assistant. Extract items from the following raw text (which may be pasted from a spreadsheet) into a structured JSON array.
      
      STRICT JSON FORMAT:
      {
        "items": [
          {
            "itemName": "Description of item",
            "make": "Brand/Make",
            "qty": 10.00,
            "uom": "NOS", 
            "rate": 500.00,
            "discount": 0.00,
            "tax": "GST @18%"
          }
        ]
      }

      INSTRUCTIONS:
      - Item Name: Full description.
      - Make: Brand if mentioned, else empty string.
      - Qty: Number.
      - UOM: Unit of measure (e.g., NOS, PCS, KG, Mtr, FT). Default to "NOS" if unclear.
      - Rate: Unit price as a number.
      - Discount: Percentage as a number (e.g., 5 for 5%). Default to 0.
      - Tax: Valid values: "GST @18%", "GST @5%", "Nil". Default to "GST @18%".
      - Return ONLY valid JSON. No conversational text.
      - If multiple items are found, extract all of them.
      - If a field is missing, use defaults specified above.`;

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a precise data extraction tool. You only output valid JSON." },
          { role: "user", content: `${prompt}\n\nRAW TEXT TO EXTRACT FROM:\n${text}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"items": []}');
      res.json(result);
    } catch (err: any) {
      console.error("[Groq Error]:", err.message || err);
      res.status(500).json({ error: "Failed to extract items with Groq" });
    }
  });

  // Purchase Orders
  app.get("/api/po/check/:poNo", authenticateToken, async (req, res) => {
    try {
      const { poNo } = req.params;
      const po = await prisma.purchaseOrder.findUnique({
        where: { po_no: poNo },
        select: { id: true, po_no: true, created_by_name: true }
      });
      res.json({ exists: !!po, po });
    } catch (error) {
      res.status(500).json({ error: "Failed to check PO number" });
    }
  });

  app.get("/api/po/latest", authenticateToken, async (req, res) => {
    try {
      const { version } = req.query;
      const cacheKey = `po:latest:${version}`;
      const cached = dbCache.get<any>(cacheKey);
      if (cached !== null) return res.json(cached);

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const isBeforeApril = month < 3;
      const startYear = isBeforeApril ? year - 1 : year;
      const startOfYear = new Date(startYear, 3, 1); // April 1st
      const endOfYear = new Date(startYear + 1, 2, 31, 23, 59, 59); // March 31st next year

      const latest = await prisma.purchaseOrder.findFirst({
        where: {
          version: String(version),
          created_at: {
            gte: startOfYear,
            lte: endOfYear
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        select: { po_no: true }
      });
      const result = { latest: latest?.po_no || null };
      dbCache.set(cacheKey, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch latest PO" });
    }
  });

  app.get("/api/po", authenticateToken, async (req, res) => {
    try {
      const cacheKey = "po:list";
      const cached = dbCache.get<any[]>(cacheKey);
      if (cached) return res.json(cached);

      const pos = await prisma.purchaseOrder.findMany({
        orderBy: { updated_at: "desc" },
        take: 500
      });
      dbCache.set(cacheKey, pos);
      res.json(pos);
    } catch (error: any) {
      console.error("[Backend] Error fetching POs:", error.message || error);
      res.status(500).json({ 
        error: "Failed to fetch POs", 
        details: error.message || String(error) 
      });
    }
  });
  app.post("/api/po", authenticateToken, async (req, res) => {
    try {
      const { id, created_at, ...data } = req.body;
      if (data.date) data.date = new Date(data.date);
      const po = await prisma.purchaseOrder.create({ data });
      dbCache.clearPattern("po:");
      res.json(po);
    } catch (error: any) {
      console.error("[Backend] PO Save Error:", error);
      if (error.code === 'P2002') {
        return res.status(400).json({ 
          error: "Duplicate PO Number", 
          details: `The PO number "${req.body.po_no}" already exists in the database. Please use a unique number.` 
        });
      }
      res.status(500).json({ error: "Failed to save PO", details: String(error) });
    }
  });

  app.get("/api/po/:id", authenticateToken, async (req, res) => {
    try {
      const cacheKey = `po:detail:${req.params.id}`;
      const cached = dbCache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const po = await prisma.purchaseOrder.findUnique({ where: { id: Number(req.params.id) } });
      if (!po) return res.status(404).json({ error: "PO not found" });
      dbCache.set(cacheKey, po);
      res.json(po);
    } catch (error) {
      console.error("[Backend] PO Fetch Error:", error);
      res.status(500).json({ error: "Failed to fetch PO" });
    }
  });

  app.put("/api/po/:id", authenticateToken, async (req, res) => {
    try {
      // Remove id from body to avoid primary key update attempt
      const { id, created_at, status, approved_by, approved_at, rejection_remarks, ...data } = req.body;
      if (data.date) data.date = new Date(data.date);
      
      // Force status back to PENDING when edited, and clear previous approval/rejection details
      const po = await prisma.purchaseOrder.update({
        where: { id: Number(req.params.id) },
        data: {
          ...data,
          status: 'PENDING',
          approved_by: null,
          approved_at: null,
          rejection_remarks: null
        }
      });
      dbCache.clearPattern("po:");
      res.json(po);
    } catch (error) {
      console.error("[Backend] PO Update Error:", error);
      res.status(500).json({ error: "Failed to update PO", details: String(error) });
    }
  });

  app.delete("/api/po/:id", authenticateToken, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const po = await prisma.purchaseOrder.findUnique({ where: { id } });
      
      if (po?.status === 'APPROVED') {
        return res.status(403).json({ error: "Cannot delete an approved Purchase Order." });
      }

      await prisma.purchaseOrder.delete({ where: { id } });
      dbCache.clearPattern("po:");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete PO" });
    }
  });

  // Comments for PO
  app.post("/api/po/:id/comments", authenticateToken, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { text } = req.body;
      const user = (req as any).user;

      const po = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!po) return res.status(404).json({ error: "PO not found" });

      const comments = Array.isArray(po.internal_comments) ? [...po.internal_comments] : [];
      comments.push({
        id: Date.now().toString(), // Add unique ID for easier deletion
        text,
        author: user.username,
        date: new Date().toISOString()
      });

      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: { internal_comments: comments }
      });

      dbCache.clearPattern("po:");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  app.delete("/api/po/:id/comments/:commentId", authenticateToken, async (req, res) => {
    try {
      const { id, commentId } = req.params;
      const po = await prisma.purchaseOrder.findUnique({ where: { id: Number(id) } });
      if (!po) return res.status(404).json({ error: "PO not found" });

      const comments = Array.isArray(po.internal_comments) ? [...(po.internal_comments as any[])] : [];
      const finalFiltered = comments.filter((c: any) => String(c.id) !== String(commentId));

      const updated = await prisma.purchaseOrder.update({
        where: { id: Number(id) },
        data: { internal_comments: finalFiltered }
      });

      dbCache.clearPattern("po:");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  app.put("/api/po/:id/comments/:commentId", authenticateToken, async (req, res) => {
    try {
      const { id, commentId } = req.params;
      const { text } = req.body;
      const po = await prisma.purchaseOrder.findUnique({ where: { id: Number(id) } });
      if (!po) return res.status(404).json({ error: "PO not found" });

      const comments = Array.isArray(po.internal_comments) ? [...(po.internal_comments as any[])] : [];
      const index = comments.findIndex((c: any) => String(c.id) === String(commentId));
      
      if (index === -1) return res.status(404).json({ error: "Comment not found" });
      
      comments[index] = { ...comments[index], text, date: new Date().toISOString() };

      const updated = await prisma.purchaseOrder.update({
        where: { id: Number(id) },
        data: { internal_comments: comments }
      });

      dbCache.clearPattern("po:");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  // Approval Workflow
  app.put("/api/po/:id/status", authenticateToken, requirePermission("APPROVE_PO"), async (req, res) => {
    try {
      const { status, remarks, pdf_base64 } = req.body;
      const user = (req as any).user;
      
      const updateData: any = { status };
      if (pdf_base64) updateData.pdf_base64 = pdf_base64;

      if (status === 'APPROVED') {
        updateData.approved_by = user.username;
        updateData.approved_at = new Date();
        updateData.rejection_remarks = null; // Clear remarks if re-approved
      } else if (status === 'REJECTED') {
        updateData.rejection_remarks = remarks || 'No reason provided';
        updateData.approved_by = null;
        updateData.approved_at = null;
      }
      
      const po = await prisma.purchaseOrder.update({
        where: { id: Number(req.params.id) },
        data: updateData
      });
      dbCache.clearPattern("po:");
      res.json(po);
    } catch (error) {
      console.error("[Backend] PO Status Update Error:", error);
      res.status(500).json({ error: "Failed to update PO status" });
    }
  });

  app.post("/api/po/:id/send", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { pdfBase64, poNo, vendorEmail, vendorName, companyName, date, createdBy, ccEmails, contact_no } = req.body;
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

      if (!n8nWebhookUrl) {
        return res.status(500).json({ error: "n8n Webhook URL not configured" });
      }

      if (!pdfBase64 || !vendorEmail) {
        return res.status(400).json({ error: "Missing required data (PDF or Vendor Email)" });
      }

      console.log(`[n8n] Sending PO ${poNo} from ${companyName || 'Hemraj'} to vendor ${vendorEmail} (CC: ${ccEmails || 'none'}, Contact: ${contact_no || 'none'})...`);

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poNo,
          vendorEmail,
          vendorName,
          companyName: companyName || "Hemraj Industries",
          date,
          createdBy,
          ccEmails,
          contact_no,
          pdfBase64
        })
      });

      if (response.ok) {
        res.json({ success: true });
      } else {
        const errText = await response.text();
        console.error("[n8n] Error response:", errText);
        res.status(502).json({ error: "Failed to trigger n8n workflow", details: errText });
      }
    } catch (error) {
      console.error("[Backend] PO Send Error:", error);
      res.status(500).json({ error: "Internal server error while sending PO" });
    }
  });

  // --- Indent API ---

  app.get("/api/indents", authenticateToken, async (req, res) => {
    try {
      const indents = await prisma.indent.findMany({
        orderBy: { created_at: "desc" }
      });
      res.json(indents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch indents" });
    }
  });

  app.post("/api/indents", authenticateToken, async (req, res) => {
    try {
      const { id, ...data } = req.body;
      if (data.date) data.date = new Date(data.date);
      
      console.log("[Backend] Saving Indent:", data.indent_no);
      const indent = await prisma.indent.create({ data });
      res.json(indent);
    } catch (error: any) {
      console.error("[Backend] Indent Save Error:", error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: "Duplicate Indent Number" });
      }
      res.status(500).json({ error: "Failed to save indent", details: error.message });
    }
  });

  app.put("/api/indents/:id", authenticateToken, async (req, res) => {
    try {
      const { id, created_at, updated_at, ...data } = req.body;
      const indent = await prisma.indent.update({
        where: { id: Number(req.params.id) },
        data
      });
      res.json(indent);
    } catch (error) {
      res.status(500).json({ error: "Failed to update indent" });
    }
  });

  app.put("/api/indents/:id/status", authenticateToken, requirePermission("APPROVE_PO"), async (req, res) => {
    try {
      const { status, remarks } = req.body;
      const user = (req as any).user;
      
      const updateData: any = { status };
      if (status === 'APPROVED') {
        updateData.approved_by = user.username;
        updateData.approved_at = new Date();
        updateData.rejection_remarks = null;
      } else if (status === 'REJECTED') {
        updateData.rejection_remarks = remarks;
        updateData.approved_by = null;
        updateData.approved_at = null;
      }
      
      const indent = await prisma.indent.update({
        where: { id: Number(req.params.id) },
        data: updateData
      });
      res.json(indent);
    } catch (error) {
      res.status(500).json({ error: "Failed to update indent status" });
    }
  });

  app.delete("/api/indents/:id", authenticateToken, async (req, res) => {
    try {
      await prisma.indent.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete indent" });
    }
  });

  app.post("/api/extract-indent", authenticateToken, async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "Missing image data" });

      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) {
        console.warn("[AI] OPENROUTER_API_KEY missing, falling back to native Gemini");
      }

      console.log(`[AI] Extracting Indent from image using ${openRouterKey ? 'OpenRouter (Gemini 2.5 Flash)' : 'Native Gemini 2.5 Flash'}...`);

      const prompt = `Extract items from this order slip image into a structured JSON.
      
      JSON FORMAT:
      {
        "items": [
          {
            "itemName": "string",
            "qty": number,
            "uom": "string",
            "applicationArea": "string",
            "orderPlacedBy": "string",
            "orderPassedBy": "string"
          }
        ]
      }

      INSTRUCTIONS:
      - Item Name: Full description.
      - Qty: Number.
      - UOM: e.g., PCS, NOS, KG.
      - Application Area: "item require for which" purpose/area.
      - Order Placed By: Name of person who placed it.
      - Order Passed By: Name of person who passed it.
      - If multiple items exist, extract all.
      - Return ONLY valid JSON.`;

      let items = [];

      if (openRouterKey) {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
            "X-Title": "QuoteCompare AI"
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${imageBase64}`
                    }
                  }
                ]
              }
            ],
            response_format: { type: "json_object" }
          })
        });

        const data = await response.json();
        if (data.choices && data.choices[0]) {
          const content = data.choices[0].message.content;
          const parsed = JSON.parse(content);
          items = parsed.items || [];
        } else {
          console.error("[OpenRouter Error]:", data);
          throw new Error("Failed to get response from OpenRouter");
        }
      } else {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
            ]
          }],
          config: { responseMimeType: "application/json" }
        });

        const parsed = JSON.parse(response.text || '{"items": []}');
        items = parsed.items || [];
      }

      res.json({ items });
    } catch (error: any) {
      console.error("[AI Indent Error]:", error.message || error);
      res.status(500).json({ error: "Failed to extract indent", details: error.message });
    }
  });

  app.delete("/api/plants/:id", authenticateToken, async (req, res) => {
    try {
      await prisma.plant.delete({ where: { id: parseInt(req.params.id) } });
      dbCache.delete("masters:all");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // --- System Roles API ---
  app.get("/api/roles", authenticateToken, async (req, res) => {
    try {
      const cacheKey = "roles:list";
      const cached = dbCache.get<any[]>(cacheKey);
      if (cached) return res.json(cached);

      const roles = await prisma.systemRole.findMany({ orderBy: { name: 'asc' } });
      dbCache.set(cacheKey, roles);
      res.json(roles);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.post("/api/roles", authenticateToken, requirePermission("MANAGE_USERS"), async (req, res) => {
    try {
      const { name } = req.body;
      const role = await prisma.systemRole.create({ data: { name: name.toUpperCase() } });
      dbCache.delete("roles:list");
      res.json(role);
    } catch (e) {
      res.status(500).json({ error: "Failed to create role. Name might be taken." });
    }
  });

  app.put("/api/roles/:id", authenticateToken, requirePermission("MANAGE_USERS"), async (req, res) => {
    try {
      const { name } = req.body;
      const role = await prisma.systemRole.update({
        where: { id: parseInt(req.params.id) },
        data: { name: name.toUpperCase() }
      });
      dbCache.delete("roles:list");
      res.json(role);
    } catch (e) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", authenticateToken, requirePermission("MANAGE_USERS"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const role = await prisma.systemRole.findUnique({ where: { id } });
      const protectedRoles = ['SUPERADMIN', 'PURCHASE_HEAD', 'USER'];
      if (protectedRoles.includes(role?.name || '')) {
        return res.status(403).json({ error: "Cannot delete core system roles" });
      }
      await prisma.systemRole.delete({ where: { id } });
      dbCache.delete("roles:list");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete role" });
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
          plant_id: plant_id ? parseInt(plant_id) : null
          // Removed created_at: new Date() to keep original creation time
        },
        create: { 
          doc_no, 
          data: data as any,
          executive_id: executive_id ? parseInt(executive_id) : null,
          plant_id: plant_id ? parseInt(plant_id) : null
        },
      });
      dbCache.clearPattern("comparisons:");
      res.json({ success: true, comparison });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/comparisons/latest-year", authenticateToken, async (req, res) => {
    try {
      const cacheKey = "comparisons:latest-year";
      const cached = dbCache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const year = new Date().getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);

      // Fetch all doc numbers for the current year
      const records = await prisma.comparison.findMany({
        where: {
          created_at: {
            gte: startOfYear,
            lte: endOfYear
          }
        },
        select: {
          doc_no: true
        }
      });

      if (records.length === 0) {
        const result = { latest: null };
        dbCache.set(cacheKey, result);
        return res.json(result);
      }

      // Find the one with the highest numeric serial number
      const latest = records.reduce((prev, curr) => {
        const getSerial = (doc: string) => {
          const parts = (doc || "").split('-');
          return parseInt(parts[parts.length - 1]) || 0;
        };
        return getSerial(curr.doc_no) > getSerial(prev.doc_no) ? curr : prev;
      });

      const result = { latest: latest.doc_no };
      dbCache.set(cacheKey, result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/comparisons", authenticateToken, async (req, res) => {
   try {
     const limit = parseInt(req.query.limit as string) || 500;
     const cacheKey = `comparisons:list:limit_${limit}`;

      const cached = dbCache.get<any[]>(cacheKey);
      if (cached) return res.json(cached);

      const comparisons = await prisma.comparison.findMany({
        take: limit,
        orderBy: { id: "desc" }, // Sort by ID descending to show most recently created first by default
        include: {
          executive: true,
          plant: true
        }
      });
      dbCache.set(cacheKey, comparisons);
      res.json(comparisons);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/comparisons/by-doc/:doc_no", authenticateToken, async (req, res) => {
    try {
      const { doc_no } = req.params;
      const cacheKey = `comparisons:detail:doc_no:${doc_no}`;
      const cached = dbCache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const comparison = await prisma.comparison.findUnique({
        where: { doc_no: doc_no },
        include: { executive: true, plant: true }
      });
      if (!comparison) return res.status(404).json({ error: "Not found" });
      dbCache.set(cacheKey, comparison);
      res.json(comparison);
    } catch (err) {
      console.error("[Backend] Fetch comparison by doc_no error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/comparisons/:id", authenticateToken, async (req, res) => {
    try {
      const cacheKey = `comparisons:detail:${req.params.id}`;
      const cached = dbCache.get<any>(cacheKey);
      if (cached) return res.json(cached);

      const comparison = await prisma.comparison.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { executive: true, plant: true }
      });
      if (!comparison) return res.status(404).json({ error: "Not found" });
      dbCache.set(cacheKey, comparison);
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
          plant_id: plant_id ? parseInt(plant_id) : null
        },
      });
      dbCache.clearPattern("comparisons:");
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
      dbCache.clearPattern("comparisons:");
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err) });
    }
  });

  // Comments for Comparison
  app.post("/api/comparisons/:id/comments", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { text } = req.body;
      const user = (req as any).user;

      const comp = await prisma.comparison.findUnique({ where: { id } });
      if (!comp) return res.status(404).json({ error: "Comparison not found" });

      const comments = Array.isArray(comp.internal_comments) ? [...comp.internal_comments] : [];
      comments.push({
        id: Date.now().toString(),
        text,
        author: user.username,
        date: new Date().toISOString()
      });

      const updated = await prisma.comparison.update({
        where: { id },
        data: { internal_comments: comments }
      });

      dbCache.clearPattern("comparisons:");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  app.delete("/api/comparisons/:id/comments/:commentId", authenticateToken, async (req, res) => {
    try {
      const { id, commentId } = req.params;
      const comp = await prisma.comparison.findUnique({ where: { id: Number(id) } });
      if (!comp) return res.status(404).json({ error: "Comparison not found" });

      const comments = Array.isArray(comp.internal_comments) ? [...comp.internal_comments] : [];
      const filtered = comments.filter((c: any) => c.id !== commentId);

      const updated = await prisma.comparison.update({
        where: { id: Number(id) },
        data: { internal_comments: filtered }
      });

      dbCache.clearPattern("comparisons:");
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
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

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("[Server Error]", err);
    res.status(err.status || 500).json({ 
      error: err.message || "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Gemini API Key Loaded: ${!!process.env.GEMINI_API_KEY ? "YES" : "NO"}`);
  });
}

startServer().catch(console.error);
