const VoiceService = require("./services/voiceService");
const fs = require("fs");

async function testVoiceService() {
  console.log("🎤 Testing Eden's Voice Service...\n");

  try {
    // Test basic voice generation
    console.log("1. Testing basic voice with sarcastic personality...");
    const result1 = await VoiceService.createFunnyVoice(
      "Hello everyone, this is a test message for Eden's new voice feature!",
      "sarcastic"
    );
    console.log(`✅ Generated: ${result1.filepath}`);
    console.log(`🎭 Personality: ${result1.personality}`);
    console.log(`📝 Voice text: ${result1.voiceText.substring(0, 100)}...\n`);

    // Check file exists
    if (fs.existsSync(result1.filepath)) {
      const stats = fs.statSync(result1.filepath);
      console.log(`📁 File size: ${stats.size} bytes`);
    }

    // Test different personalities
    console.log("2. Testing different personalities...");
    const personalities = VoiceService.getVoicePersonalities();
    console.log("Available personalities:", personalities.length);
    personalities.forEach((p) => {
      console.log(`   • ${p.name}: ${p.description}`);
    });

    // Test with emoji text
    console.log("\n3. Testing emoji handling...");
    const result2 = await VoiceService.createFunnyVoice(
      "OMG this is so funny 😂😂😂 I can't stop laughing! 🤣💯🔥",
      "excited"
    );
    console.log(
      `✅ Emoji text processed: ${result2.voiceText.substring(0, 100)}...\n`
    );

    // Test cleanup
    console.log("4. Testing cleanup...");
    result1.cleanup();
    result2.cleanup();
    console.log("✅ Cleanup completed\n");

    // Test error handling
    console.log("5. Testing error handling...");
    try {
      await VoiceService.createFunnyVoice("", "nonexistent");
    } catch (error) {
      console.log("✅ Error handling works:", error.message.substring(0, 50));
    }

    console.log("\n🎉 All voice tests completed successfully!");
    console.log("\nVoice responses available:");
    const responses = VoiceService.getVoiceResponses();
    responses.forEach((resp, i) => {
      console.log(`   ${i + 1}. ${resp}`);
    });
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testVoiceService();
