#!/usr/bin/env node

console.log("🧪 Testing Eden Configuration...\n");

require("dotenv").config();

// Test environment variables
console.log("📋 Environment Check:");
console.log("BOT_NAME:", process.env.BOT_NAME || "Not set");
console.log("COMMAND_PREFIX:", process.env.COMMAND_PREFIX || "Not set");

// Test LLM providers
console.log("\n🤖 LLM Providers:");

const providers = {
  "Groq (FREE)":
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your_groq_api_key_here",
  "Hugging Face (FREE)":
    process.env.HUGGINGFACE_API_KEY &&
    process.env.HUGGINGFACE_API_KEY !== "your_huggingface_api_key_here",
  "Cohere (FREE)":
    process.env.COHERE_API_KEY &&
    process.env.COHERE_API_KEY !== "your_cohere_api_key_here",
  "Ollama (LOCAL)":
    process.env.OLLAMA_URL &&
    process.env.OLLAMA_URL !== "http://localhost:11434",
  "OpenAI (PAID)":
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== "your_openai_api_key_here",
};

let configuredCount = 0;
for (const [provider, configured] of Object.entries(providers)) {
  const status = configured ? "✅ Configured" : "❌ Not configured";
  console.log(`${provider}: ${status}`);
  if (configured) configuredCount++;
}

console.log(`\n📊 Total configured: ${configuredCount}/5`);

if (configuredCount === 0) {
  console.log("\n⚠️  No LLM providers configured!");
  console.log("Eden will use fallback responses.");
  console.log("\n🆓 Quick setup for FREE providers:");
  console.log("1. Groq: https://console.groq.com/ (RECOMMENDED)");
  console.log("2. Ollama: brew install ollama && ollama pull llama2");
} else {
  console.log("\n🎉 Eden is configured and ready!");
  console.log("Run: npm start");
}

// Test LLM Service
console.log("\n🧪 Testing LLM Service...");
try {
  const LLMService = require("./services/llmService");
  const llm = new LLMService();
  console.log("✅ LLM Service loaded successfully");

  // Test fallback response
  const fallback = llm.getFallbackMeanResponse();
  console.log("📝 Sample fallback response:", fallback);
} catch (error) {
  console.log("❌ LLM Service error:", error.message);
}

console.log("\n✨ Test complete!");
