import { Express } from "express";
import { google } from "googleapis";
import { GoogleGenAI, Type } from "@google/genai";

export function setupGmailRoutes(app: Express) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  app.post("/api/sync-gmail", async (req, res) => {
    try {
      const { accessToken, query } = req.body;
      if (!accessToken) return res.status(400).json({ error: "Missing accessToken" });

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      // Fetch message list
      const msgListRes = await gmail.users.messages.list({
        userId: "me",
        q: query || "has:attachment",
        maxResults: 3, // Keep the limit small so it doesn't take forever
      });
      const messages = msgListRes.data.messages || [];

      if (!messages.length) {
        return res.json({ success: true, parsedData: null, message: "No messages found" });
      }

      const emailContents = [];
      for (const msg of messages) {
        if (!msg.id) continue;
        const detail = await gmail.users.messages.get({ userId: "me", id: msg.id });
        let textContent = "";
        
        // Very basic recursion to get text parts
        const extractText = (parts: any[]) => {
          for (const part of parts) {
            if (part.mimeType === "text/plain" && part.body?.data) {
              textContent += Buffer.from(part.body.data, "base64").toString("utf-8") + "\n";
            } else if (part.parts) {
              extractText(part.parts);
            }
          }
        };

        if (detail.data.payload?.parts) {
          extractText(detail.data.payload.parts);
        } else if (detail.data.payload?.body?.data) {
          textContent += Buffer.from(detail.data.payload.body.data, "base64").toString("utf-8");
        }

        emailContents.push(`Email Snapshot:\n${textContent}\n`);
      }

      // Convert unstructured email texts to our ComparisonData format using Gemini
      const prompt = `
        You are an expert procurement assistant. Extract pricing, quotes, items, vendors, and relevant table details from the following emails. 
        Pay special attention to terms and conditions:
        - Delivery Period: Time required for delivery (e.g., 2 weeks, immediate).
        - Freight: Transportation charges (e.g., extra at actuals, included, Rs. 500).
        - Packing & Forwarding (P&F): CRITICAL. Look for keywords like "PACKING AND FORWARDING", "P&F", "Packaging". Extract the exact percentage or value (e.g., "@2%", "2%", "Extra", "Included"). If not mentioned, leave blank.
        - Ready Stock: Availability of items in stock (Yes/No).
        - GST Status: CRITICAL. Identify if the price/MRP is "Inclusive" of GST or "Exclusive" of GST. 
          Look for keywords like "Including GST", "GST Inclusive", "All Inclusive", "GST Extra", "Plus GST", "GST @ 18%", or "TAXES EXTRA". 
          If the quote says "GST Extra", "Plus GST", or "TAXES EXTRA", set it to "Exclusive".
          If the quote says "Inclusive of all taxes", "GST Paid", or "prices are inclusive of GST", set it to "Inclusive".
        - Other Extra: Any other additional charges or special terms.

        Format your response EXACTLY to match the JSON schema. If you don't find enough details, do your best and leave other fields empty.

        Emails:
        ${emailContents.join("\n---\n")}
      `;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              header: {
                type: Type.OBJECT,
                properties: {
                  docNo: { type: Type.STRING },
                  preparedBy: { type: Type.STRING },
                  date: { type: Type.STRING },
                  indentDate: { type: Type.STRING },
                  plantName: { type: Type.STRING },
                }
              },
              data: {
                type: Type.OBJECT,
                properties: {
                  vendors: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        indentNo: { type: Type.STRING },
                        siNo: { type: Type.STRING },
                        description: { type: Type.STRING },
                        uom: { type: Type.STRING },
                        qty: { type: Type.STRING },
                        previousPrice: {
                          type: Type.OBJECT,
                          properties: {
                            rate: { type: Type.STRING },
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
                              mrp: { type: Type.STRING },
                              discount: { type: Type.STRING },
                              netRate: { type: Type.STRING },
                              totalAmount: { type: Type.STRING },
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
                }
              }
            }
          }
        }
      });

      const parsedJSON = JSON.parse(aiResponse.text || "{}");
      res.json({ success: true, parsedData: parsedJSON });

    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });
}
