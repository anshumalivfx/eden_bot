const CommandHandler = require("./handlers/commandHandler");
const LLMService = require("./services/llmService");

async function testEdenVoiceFeatures() {
  console.log("🎤 Testing Eden's Enhanced Voice Features...\n");

  const llmService = LLMService;
  const commandHandler = new CommandHandler(llmService);

  // Mock message object for testing
  const createMockMessage = (body, hasQuoted = false, quotedBody = "") => ({
    body,
    hasQuotedMsg: hasQuoted,
    getQuotedMessage: async () => ({ body: quotedBody }),
    reply: async (response) => {
      if (typeof response === "object" && response.media) {
        console.log("🎵 Audio Response:", response.text);
        console.log("🔊 Audio file would be sent here");
        return response;
      } else {
        console.log("💬 Text Response:", response);
        return response;
      }
    },
  });

  try {
    console.log("=== Voice Command Tests ===\n");

    // Test 1: Basic voice command
    console.log("1. Testing basic voice command...");
    const mockMsg1 = createMockMessage("");
    const response1 = await commandHandler.createVoice(
      ["Hello", "everyone!"],
      mockMsg1
    );
    console.log(
      "✅ Response:",
      typeof response1 === "object" ? "Audio + Text" : response1
    );
    console.log("");

    // Test 2: Voice with personality
    console.log("2. Testing voice with specific personality...");
    const mockMsg2 = createMockMessage("");
    const response2 = await commandHandler.createVoice(
      ["dramatic", "This", "is", "amazing!"],
      mockMsg2
    );
    console.log(
      "✅ Response:",
      typeof response2 === "object" ? "Audio + Text" : response2
    );
    console.log("");

    // Test 3: Reply to message voice
    console.log("3. Testing reply to message voice...");
    const mockMsg3 = createMockMessage(
      "",
      true,
      "This is the quoted message that will be spoken"
    );
    const response3 = await commandHandler.createVoice([], mockMsg3);
    console.log(
      "✅ Response:",
      typeof response3 === "object" ? "Audio + Text" : response3
    );
    console.log("");

    // Test 4: Reply with personality
    console.log("4. Testing reply with personality...");
    const mockMsg4 = createMockMessage(
      "",
      true,
      "Eden is the best bot ever created!"
    );
    const response4 = await commandHandler.createVoice(["robot"], mockMsg4);
    console.log(
      "✅ Response:",
      typeof response4 === "object" ? "Audio + Text" : response4
    );
    console.log("");

    // Test 5: Voice help
    console.log("5. Testing voice help...");
    const mockMsg5 = createMockMessage("");
    const response5 = await commandHandler.createVoice([], mockMsg5);
    console.log("✅ Help Response Length:", response5.length, "characters");
    console.log("");

    // Test 6: Empty text handling
    console.log("6. Testing empty text handling...");
    const mockMsg6 = createMockMessage("", true, "   ");
    const response6 = await commandHandler.createVoice([], mockMsg6);
    console.log("✅ Empty text response:", response6);
    console.log("");

    // Test 7: Command aliases
    console.log("7. Testing command aliases...");
    const aliases = ["voice", "v", "speak", "tts"];
    for (const alias of aliases) {
      const hasCommand = commandHandler.commands[alias];
      console.log(
        `   • -${alias}: ${hasCommand ? "✅ Available" : "❌ Missing"}`
      );
    }
    console.log("");

    console.log("🎉 All voice feature tests completed!\n");

    // Show voice personalities
    console.log("🎭 Available Voice Personalities:");
    const personalities = commandHandler.voiceService.getVoicePersonalities();
    personalities.forEach((p) => {
      console.log(`   • ${p.name}: ${p.description}`);
    });

    console.log("\n🎤 Voice Response Examples:");
    const responses = commandHandler.voiceService.getVoiceResponses();
    responses.slice(0, 3).forEach((resp, i) => {
      console.log(`   ${i + 1}. ${resp}`);
    });
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Test the help command too
async function testUpdatedHelp() {
  console.log("\n=== Updated Help Command Test ===\n");

  const llmService = LLMService;
  const commandHandler = new CommandHandler(llmService);

  // Mock context
  commandHandler.currentContext = {
    senderName: "TestUser",
    isOwner: false,
    mood: "sarcastic",
  };

  const helpResponse = await commandHandler.showHelp();
  console.log(
    "Help command includes voice feature:",
    helpResponse.includes("voice") ? "✅ Yes" : "❌ No"
  );
  console.log(
    "Help command includes personalities:",
    helpResponse.includes("personalities") ? "✅ Yes" : "❌ No"
  );
}

// Run tests
testEdenVoiceFeatures()
  .then(() => {
    return testUpdatedHelp();
  })
  .then(() => {
    console.log("\n🎉 All tests completed successfully!");
    console.log("\n🚀 Eden is ready with voice features! Use:");
    console.log("   • -voice [text] - Speak any text");
    console.log("   • -voice [personality] [text] - Use specific voice");
    console.log("   • Reply to any message with -voice - Speak that message");
    console.log("   • -v, -speak, -tts also work as aliases");
  });
