import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-flash-latest"];
  for (const m of models) {
    try {
      await ai.models.generateContent({ model: m, contents: "hi" });
      console.log(m, "WORKS");
    } catch(e) {
      console.log(m, "FAILS", e.message);
    }
  }
}
run();
