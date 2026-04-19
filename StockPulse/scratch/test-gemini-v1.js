require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testV1() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: "v1" }); // Try V1 explicitly
  
  try {
    console.log("Testing gemini-1.5-flash on V1...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hi");
    console.log("Success with gemini-1.5-flash on V1!");
    console.log("Response:", result.response.text());
  } catch (err) {
    console.error("Failed on V1:", err.message);
  }
}

testV1();
