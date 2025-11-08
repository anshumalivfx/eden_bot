#!/usr/bin/env node

console.log("🎭 Eden Feature Demo\n");

require("dotenv").config();
const LLMService = require("./services/llmService");
const CommandHandler = require("./handlers/commandHandler");

async function demoFeatures() {
  const llm = new LLMService();
  const handler = new CommandHandler(llm);

  console.log("🎯 Testing Name Mention Response...");
  try {
    const response = await llm.generateContextualResponse(
      "Hey Eden, what do you think about this?",
      "Someone mentioned your name in a group chat. Respond wittily.",
      { senderName: "TestUser", mood: "sarcastic" }
    );
    console.log("✅ Eden says:", response);
  } catch (error) {
    console.log(
      "⚠️ Using fallback:",
      llm.getContextualFallback("TestUser", false, "sarcastic")
    );
  }

  console.log("\n👑 Testing Owner Recognition...");
  try {
    const response = await llm.generateContextualResponse(
      "Eden, roast me",
      "This is your creator asking for a roast. Be less mean but still sarcastic.",
      { senderName: "Ansh", isOwner: true, mood: "sarcastic" }
    );
    console.log("✅ Eden says to Ansh:", response);
  } catch (error) {
    console.log(
      "⚠️ Using fallback:",
      llm.getContextualFallback("Ansh", true, "sarcastic")
    );
  }

  console.log("\n🎪 Testing New Commands...");

  // Test mood command
  const mockContext = { senderName: "Demo", mood: "savage", isOwner: false };
  handler.currentContext = mockContext;

  console.log("Command: -mood");
  const moodResponse = await handler.checkMood();
  console.log("✅ Response:", moodResponse);

  console.log("\nCommand: -excuse being late");
  try {
    const excuseResponse = await handler.generateExcuse(["being", "late"]);
    console.log("✅ Response:", excuseResponse);
  } catch (error) {
    console.log(
      '⚠️ Fallback: "Sorry I\'m late, I was busy teaching my goldfish quantum physics!"'
    );
  }

  console.log("\n🔧 Configuration Summary:");
  console.log("✅ Name Triggers:", process.env.TRIGGER_NAMES);
  console.log("✅ Owner Name:", process.env.OWNER_NAME);
  console.log("✅ Trigger Probability:", process.env.TRIGGER_PROBABILITY);
  console.log("✅ Features Enabled:");
  console.log("   - Random Messages:", process.env.ENABLE_RANDOM_MESSAGES);
  console.log("   - Mood System:", process.env.ENABLE_MOOD_SYSTEM);
  console.log("   - Smart Context:", process.env.ENABLE_SMART_CONTEXT);

  console.log("\n🎉 All features loaded successfully!");
  console.log("\n🚀 Ready to start Eden with: npm start");
}

demoFeatures().catch(console.error);
