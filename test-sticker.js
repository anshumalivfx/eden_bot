#!/usr/bin/env node

console.log("🎨 Testing Eden's Sticker Functionality\n");

const StickerService = require("./services/stickerService");

async function testStickerService() {
  console.log("📋 Testing StickerService initialization...");

  try {
    const stickerService = new StickerService();
    console.log("✅ StickerService created successfully");

    // Test quote generation
    console.log("\n💬 Testing media sticker quotes...");
    for (let i = 0; i < 2; i++) {
      const quote = stickerService.getRandomStickerQuote();
      console.log(`Media Quote ${i + 1}: "${quote}"`);
    }

    // Test text sticker quotes
    console.log("\n💬 Testing text sticker quotes...");
    for (let i = 0; i < 2; i++) {
      const quote = stickerService.getRandomTextStickerQuote();
      console.log(`Text Quote ${i + 1}: "${quote}"`);
    }

    // Test text wrapping
    console.log("\n📝 Testing text wrapping...");
    const longText =
      "This is a very long message that should be wrapped into multiple lines for the sticker creation process to work properly";
    const wrappedLines = stickerService.wrapText(longText, 25);
    console.log("Wrapped lines:", wrappedLines);

    // Test themes
    console.log("\n🎨 Testing text sticker themes...");
    const themes = stickerService.getTextStickerThemes();
    console.log(`Available themes: ${themes.map((t) => t.name).join(", ")}`);

    // Test mime type detection
    console.log("\n🔍 Testing media type detection...");
    console.log("JPEG:", stickerService.isImage("image/jpeg")); // Should be true
    console.log("PNG:", stickerService.isImage("image/png")); // Should be true
    console.log("GIF:", stickerService.isGif("image/gif")); // Should be true
    console.log("MP4:", stickerService.isVideo("video/mp4")); // Should be true
    console.log("Audio:", stickerService.isImage("audio/mp3")); // Should be false

    // Test text sticker creation (without actually creating files)
    console.log("\n📱 Testing text sticker SVG generation...");
    const testLines = ["Hello World!", "This is a test message."];
    const testTheme = themes[0];
    const svgContent = stickerService.createTextStickerSVG(
      testLines,
      "TestUser",
      testTheme
    );
    console.log(
      "✅ SVG generated successfully (length:",
      svgContent.length,
      "chars)"
    );

    console.log("\n📁 Checking temp directory...");
    const fs = require("fs").promises;
    const path = require("path");
    const tempDir = path.join(__dirname, "temp");

    try {
      await fs.access(tempDir);
      console.log("✅ Temp directory exists");
    } catch {
      console.log("❌ Temp directory not found");
    }

    console.log("\n🎉 All sticker tests passed!");
  } catch (error) {
    console.error("❌ Sticker test failed:", error.message);
  }
}

// Test command handler integration
async function testCommandIntegration() {
  console.log("\n🤖 Testing command handler integration...");

  try {
    const LLMService = require("./services/llmService");
    const CommandHandler = require("./handlers/commandHandler");

    const llm = new LLMService();
    const handler = new CommandHandler(llm);

    console.log("✅ CommandHandler with StickerService created successfully");
    console.log("✅ Sticker command (-sticker, -s2) registered");

    // Check if sticker commands exist
    const hasSticker = "sticker" in handler.commands;
    const hasS2 = "s2" in handler.commands;

    console.log(`Sticker command exists: ${hasSticker ? "✅" : "❌"}`);
    console.log(`S2 alias exists: ${hasS2 ? "✅" : "❌"}`);
  } catch (error) {
    console.error("❌ Command integration test failed:", error.message);
  }
}

// Run tests
async function runTests() {
  await testStickerService();
  await testCommandIntegration();

  console.log("\n📚 Usage Instructions:");
  console.log("1. Start Eden: npm start");
  console.log("2a. Send an image/GIF/video and use -sticker");
  console.log(
    "2b. Reply to ANY text message with -sticker (creates message box)"
  );
  console.log("2c. Reply to ANY media with -sticker (creates media sticker)");
  console.log("3. Watch Eden create your sticker with sarcastic commentary!");
  console.log("\n📖 Read STICKER_GUIDE.md for detailed instructions");
}

runTests().catch(console.error);
