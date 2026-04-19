"use server";

import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Matching the exact type expected by your StockPulse dashboard component
export async function getAIInsight(ticker: string): Promise<{ 
  summary?: string; 
  sentimentTag?: "BULLISH" | "BEARISH" | "NEUTRAL"; 
  error?: string 
}> {
  if (!GEMINI_API_KEY) {
    return { error: "Gemini API key is not configured. Add GEMINI_API_KEY to your .env file." };
  }

  // Strip out invalid characters but keep standard ticker formats (allow & for M&M)
  const sanitized = ticker.trim().toUpperCase().replace(/[^A-Z0-9:.&]/g, "");
  if (!sanitized || sanitized.length > 20) {
    return { error: "Please enter a valid stock ticker symbol." };
  }

  try {
    console.log(`Attempting AI insight for ${sanitized} with model: gemini-1.5-flash`);
    
    // Initialize the new GenAI SDK
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = `You are a neutral quantitative financial data summarizer for a premium trading portal. Analyze the current market sentiment for the stock ticker "${sanitized}".

    Strict Constraints:
    1. Respond ONLY with a valid JSON object.
    2. Provide financial advice, recommendations, or predictions , while marking them just ai generated and not be believed blindly.
    3. Use generally known public information and summarize the current general market perception.
    
    The JSON object must strictly follow this structure:
    {
      "sentimentTag": "Must be exactly one of: BULLISH, BEARISH, or NEUTRAL",
      "summary": "A concise 6-8 sentence, objective market sentiment overview."
    }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        // This ensures the AI returns clean JSON without markdown blocks (```json)
        responseMimeType: "application/json",
      }
    });

    const text = response.text;

    if (text && text.trim().length > 0) {
      try {
        const parsedData = JSON.parse(text);
        console.log(`Success with model: gemini-1.5-flash for ${sanitized}`);
        
        return { 
          summary: parsedData.summary,
          sentimentTag: parsedData.sentimentTag
        };
      } catch (parseError) {
        console.error("Failed to parse Gemini JSON:", text);
        return { error: "Received an invalid format from the AI. Please try again." };
      }
    } else {
      return { error: "The AI returned an empty response. Please try again." };
    }
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    
    const message = err.message || "Unknown error";
    
    // Your robust error handling mapped to the UI
    if (message.includes("429") || message.includes("quota")) {
      return { error: "FREE TIER QUOTA EXCEEDED. Please check Google AI Studio to ensure your API Key is active." };
    }
    if (message.includes("404") || message.includes("not found")) {
      return { error: "MODEL NOT FOUND: Gemini 1.5 Flash is not found for your current key. Ensure the 'Generative Language API' is enabled." };
    }
    
    return { error: `Gemini API Error: ${message.substring(0, 80)}...` };
  }
}