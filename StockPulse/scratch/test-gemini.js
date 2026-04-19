require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const models = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
    "gemini-3-flash-preview",
    "gemini-pro"
  ];

  for (const m of models) {
    try {
      console.log(`Testing ${m}...`);
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent("Hi");
      console.log(`✅ Success with ${m}:`, result.response.text().substring(0, 50));
      return; // Exit on first success
    } catch (err) {
      console.error(`❌ Failed with ${m}:`, err.message);
    }
  }
}

testModels();
