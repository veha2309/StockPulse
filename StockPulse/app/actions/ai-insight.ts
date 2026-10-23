"use server";

import { cookies } from "next/headers";
import { verifySession, cookieName } from "@/lib/session";
import { rateLimit } from "@/lib/database";
import { yahooChart } from "@/lib/market-data";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Prioritized list of models for failover
const MODEL_PRIORITY = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-2.0-flash",
  "gemini-3-flash-preview",
  "gemini-1.5-flash",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
];

const MAX_RETRIES_PER_MODEL = 1;
const RETRY_DELAY = 1500; // 1.5s delay for 503s

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getAIInsight(ticker: string): Promise<{
  summary?: string;
  sentimentTag?: "BULLISH" | "BEARISH" | "NEUTRAL";
  error?: string;
}> {
  const session = verifySession(
    (await cookies()).get(cookieName("user"))?.value,
    "user",
  );
  if (!session) return { error: "Sign in to request market insight" };
  const limited = await rateLimit("market-insight", session.email, 10, 3600);
  if (limited)
    return {
      error:
        "Market insight is temporarily unavailable or your request limit has been reached",
    };
  if (!GEMINI_API_KEY) {
    return {
      error:
        "Gemini API key is not configured. Add GEMINI_API_KEY to your .env file.",
    };
  }

  const sanitized = ticker
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9:.&]/g, "");
  if (!sanitized || sanitized.length > 20) {
    return { error: "Please enter a valid stock ticker symbol." };
  }

  let observations;
  try {
    const result = await yahooChart(
      sanitized.startsWith("NSE:") || sanitized.startsWith("BSE:")
        ? sanitized
        : "NSE:" + sanitized,
      "1d",
    );
    observations = {
      price: result.meta.regularMarketPrice,
      previousClose:
        result.meta.chartPreviousClose ?? result.meta.previousClose,
      asOf: result.meta.regularMarketTime,
    };
  } catch {
    return {
      error:
        "Current quote data is unavailable. No sentiment analysis was generated.",
    };
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const prompt = `You are a neutral financial analyst. Analyze market sentiment for stock ticker "${sanitized}".
  Base your response ONLY on these quote observations: ${JSON.stringify(observations)}. You have no news or fundamental data. State that sentiment is price-derived, avoid predictions, and do not invent events or current news.
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
        console.log(
          `[AI Insight] Attempting with model: ${modelName} (Attempt ${attempts + 1})`,
        );

        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
          },
        });

        const result = await model.generateContent(prompt, { timeout: 10000 });
        const response = await result.response;
        const text = response.text();

        if (text && text.trim().length > 0) {
          const parsedData = JSON.parse(text);
          if (
            typeof parsedData.summary !== "string" ||
            !parsedData.summary.trim() ||
            parsedData.summary.length > 5000 ||
            !["BULLISH", "BEARISH", "NEUTRAL"].includes(parsedData.sentimentTag)
          )
            throw new Error("Invalid insight response");
          console.log(`[AI Insight] Success with model: ${modelName}`);
          return {
            summary: parsedData.summary,
            sentimentTag: parsedData.sentimentTag,
          };
        }

        throw new Error("Empty response from model");
      } catch (err) {
        attempts++;
        const status =
          typeof err === "object" && err !== null && "status" in err
            ? Number(err.status)
            : 0;
        const message =
          err instanceof Error ? err.message : "Unknown model error";

        console.error(`[AI Insight] Model ${modelName} failed:`, message);

        // If it's a 503 (High Demand) or 429 (Rate Limit) and we have retries left, wait and retry
        if (
          (status === 503 ||
            status === 429 ||
            message.includes("503") ||
            message.includes("429")) &&
          attempts <= MAX_RETRIES_PER_MODEL
        ) {
          console.log(
            `[AI Insight] Service busy. Retrying model ${modelName} in ${RETRY_DELAY}ms...`,
          );
          await wait(RETRY_DELAY);
          continue;
        }

        // Otherwise, break inner loop and try NEXT model in priority list
        break;
      }
    }
  }

  return {
    error:
      "All AI models are currently experiencing high demand. Please try again in a moment.",
  };
}
