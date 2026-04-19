"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Prioritized list of models for failover
const MODEL_PRIORITY = [
  "gemini-2.0-flash",
  "gemini-3-flash-preview",
  "gemini-1.5-flash",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro"
];

const MAX_RETRIES_PER_MODEL = 1;
const RETRY_DELAY = 1500; // 1.5s delay for 503s

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getAIInsight(ticker: string): Promise<{ 
  summary?: string; 
  sentimentTag?: "BULLISH" | "BEARISH" | "NEUTRAL"; 
  error?: string 
}> {
  if (!GEMINI_API_KEY) {
    return { error: "Gemini API key is not configured. Add GEMINI_API_KEY to your .env file." };
  }

  const sanitized = ticker.trim().toUpperCase().replace(/[^A-Z0-9:.&]/g, "");
  if (!sanitized || sanitized.length > 20) {
    return { error: "Please enter a valid stock ticker symbol." };
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  const prompt = `You are a neutral financial analyst. Analyze market sentiment for stock ticker "${sanitized}".
  Respond ONLY with a valid JSON object.
  JSON Structure:
  {
    "sentimentTag": "BULLISH" | "BEARISH" | "NEUTRAL",
    "summary": "6-8 objective sentences summarizing market perception."
  }`;

  // Try each model in sequence
  for (const modelName of MODEL_PRIORITY) {
    let attempts = 0;
    
    while (attempts <= MAX_RETRIES_PER_MODEL) {
      try {
        console.log(`[AI Insight] Attempting with model: ${modelName} (Attempt ${attempts + 1})`);
        
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
          }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (text && text.trim().length > 0) {
          const parsedData = JSON.parse(text);
          console.log(`[AI Insight] Success with model: ${modelName}`);
          return { 
            summary: parsedData.summary,
            sentimentTag: parsedData.sentimentTag
          };
        }
        
        throw new Error("Empty response from model");

      } catch (err: any) {
        attempts++;
        const status = err.status || 0;
        const message = err.message || "";
        
        console.error(`[AI Insight] Model ${modelName} failed:`, message);

        // If it's a 503 (High Demand) or 429 (Rate Limit) and we have retries left, wait and retry
        if ((status === 503 || status === 429 || message.includes("503") || message.includes("429")) && attempts <= MAX_RETRIES_PER_MODEL) {
          console.log(`[AI Insight] Service busy. Retrying model ${modelName} in ${RETRY_DELAY}ms...`);
          await wait(RETRY_DELAY);
          continue; 
        }

        // Otherwise, break inner loop and try NEXT model in priority list
        break; 
      }
    }
  }

  return { error: "All AI models are currently experiencing high demand. Please try again in a moment." };
}