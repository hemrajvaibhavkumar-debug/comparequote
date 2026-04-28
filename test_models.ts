import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function test() {
  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-flash-latest"
  ];

  for (const model of models) {
    console.log(`Testing ${model}...`);
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: "ping" }] }]
      });
      console.log(`✅ ${model} works!`);
      return model;
    } catch (e) {
      console.log(`❌ ${model} failed: ${e.message}`);
    }
  }
}

test().then(m => {
  if (m) console.log(`BEST MODEL: ${m}`);
  else console.log("No models worked.");
});
