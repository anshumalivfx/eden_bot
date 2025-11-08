#!/usr/bin/env node

console.log("🚀 Eden - Your Sarcastic WhatsApp Companion\n");

const fs = require("fs");
const path = require("path");

// Check if .env file exists and is configured
if (!fs.existsSync(".env")) {
  console.error("❌ .env file not found!");
  console.log("Please copy and configure the .env file");
  process.exit(1);
}

const envContent = fs.readFileSync(".env", "utf8");

// Check if any LLM provider is configured
const hasOpenAI =
  envContent.includes("OPENAI_API_KEY=") &&
  !envContent.includes("your_openai_api_key_here");
const hasGroq =
  envContent.includes("GROQ_API_KEY=") &&
  !envContent.includes("your_groq_api_key_here");
const hasHuggingFace =
  envContent.includes("HUGGINGFACE_API_KEY=") &&
  !envContent.includes("your_huggingface_api_key_here");
const hasCohere =
  envContent.includes("COHERE_API_KEY=") &&
  !envContent.includes("your_cohere_api_key_here");
const hasOllama =
  envContent.includes("OLLAMA_URL=") && !envContent.includes("localhost:11434");

if (!hasOpenAI && !hasGroq && !hasHuggingFace && !hasCohere && !hasOllama) {
  console.log(
    "⚠️  No LLM provider configured. Eden will use fallback responses."
  );
  console.log("");
  console.log("🆓 FREE LLM Options (recommended):");
  console.log("");
  console.log("1. Groq (BEST FREE OPTION):");
  console.log("   • Go to: https://console.groq.com/");
  console.log("   • Sign up for free");
  console.log("   • Get API key");
  console.log("   • Add to .env: GROQ_API_KEY=your_key");
  console.log("");
  console.log("2. Ollama (100% Free, Local):");
  console.log("   • Install: brew install ollama");
  console.log("   • Run: ollama pull llama2 && ollama serve");
  console.log("");
  console.log("3. Hugging Face (Free tier):");
  console.log("   • Go to: https://huggingface.co/");
  console.log("   • Get token and add: HUGGINGFACE_API_KEY=your_token");
  console.log("");
  console.log("📖 See FREE_LLM_SETUP.md for detailed instructions");
  console.log("");
} else {
  let configuredProviders = [];
  if (hasGroq) configuredProviders.push("Groq (Free)");
  if (hasHuggingFace) configuredProviders.push("Hugging Face (Free)");
  if (hasCohere) configuredProviders.push("Cohere (Free)");
  if (hasOllama) configuredProviders.push("Ollama (Local)");
  if (hasOpenAI) configuredProviders.push("OpenAI (Paid)");

  console.log("✅ LLM Providers configured:", configuredProviders.join(", "));
}

console.log("📱 Starting Eden...");
console.log("😈 Ready to be sarcastic and mean (but funny)!");
console.log('📝 Commands start with "-" (e.g., -help, -roast, -ask question)');
console.log("🔗 Scan the QR code with your phone when it appears");
console.log("");

// Start the main bot
require("./index.js");
