#!/usr/bin/env node

/**
 * Test script for mention and reply detection
 * This simulates the bot's mention/reply detection logic
 */

console.log("🧪 Testing Mention & Reply Detection\n");

// Mock data
const TRIGGER_NAMES = ["Eden", "eden", "Ansh", "@~Ansh"];
const botId = "1234567890@c.us"; // Mock bot ID

// Test cases
const testCases = [
  {
    name: "Direct mention in text",
    message: { body: "Hey Eden, how are you?", fromMe: false },
    expectedMention: true,
    expectedReply: false,
  },
  {
    name: "Owner name mention",
    message: { body: "Ansh is the creator", fromMe: false },
    expectedMention: true,
    expectedReply: false,
  },
  {
    name: "Case-insensitive mention",
    message: { body: "what do you think eden?", fromMe: false },
    expectedMention: true,
    expectedReply: false,
  },
  {
    name: "No mention",
    message: { body: "This is a regular message", fromMe: false },
    expectedMention: false,
    expectedReply: false,
  },
  {
    name: "Reply to bot message",
    message: {
      body: "I disagree",
      fromMe: false,
      hasQuotedMsg: true,
      quotedMsg: { fromMe: true, body: "That's wrong" },
    },
    expectedMention: false,
    expectedReply: true,
  },
  {
    name: "Reply to other user",
    message: {
      body: "I agree",
      fromMe: false,
      hasQuotedMsg: true,
      quotedMsg: { fromMe: false, body: "Something" },
    },
    expectedMention: false,
    expectedReply: false,
  },
  {
    name: "Own message (should skip)",
    message: { body: "Eden test", fromMe: true },
    expectedMention: false, // Should be skipped
    expectedReply: false,
  },
  {
    name: "Multiple triggers",
    message: { body: "Hey @~Ansh and Eden", fromMe: false },
    expectedMention: true,
    expectedReply: false,
  },
];

// Helper functions (simplified versions)
function isBotMentioned(message) {
  if (message.fromMe) return false;

  const messageBody = message.body.toLowerCase();
  for (const name of TRIGGER_NAMES) {
    if (messageBody.includes(name.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function isReplyToBot(message) {
  if (message.fromMe) return false;

  if (message.hasQuotedMsg && message.quotedMsg) {
    return message.quotedMsg.fromMe;
  }
  return false;
}

// Run tests
let passed = 0;
let failed = 0;

console.log("Running test cases...\n");

testCases.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`);

  const mentionResult = isBotMentioned(test.message);
  const replyResult = isReplyToBot(test.message);

  const mentionPass = mentionResult === test.expectedMention;
  const replyPass = replyResult === test.expectedReply;

  if (mentionPass && replyPass) {
    console.log(`✅ PASSED`);
    passed++;
  } else {
    console.log(`❌ FAILED`);
    if (!mentionPass) {
      console.log(
        `   Mention: Expected ${test.expectedMention}, got ${mentionResult}`
      );
    }
    if (!replyPass) {
      console.log(
        `   Reply: Expected ${test.expectedReply}, got ${replyResult}`
      );
    }
    failed++;
  }
  console.log("");
});

// Summary
console.log("=".repeat(50));
console.log("📊 Test Summary:");
console.log(`   ✅ Passed: ${passed}/${testCases.length}`);
console.log(`   ❌ Failed: ${failed}/${testCases.length}`);
console.log(
  `   📈 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`
);
console.log("=".repeat(50));

if (failed === 0) {
  console.log("\n🎉 All tests passed! Mention & Reply detection is working!");
} else {
  console.log("\n⚠️  Some tests failed. Please check the implementation.");
  process.exit(1);
}

// Bonus: Show example scenarios
console.log("\n📝 Example Scenarios:\n");

const scenarios = [
  {
    situation: "Group Chat - Someone mentions Eden",
    message: "Hey Eden, what do you think about this code?",
    botAction: "✅ Will respond (mentioned)",
  },
  {
    situation: "Group Chat - Someone replies to Eden's message",
    message: "[Reply to Eden] I disagree with your assessment",
    botAction: "✅ Will respond (replied to)",
  },
  {
    situation: "Group Chat - Normal conversation",
    message: "I think we should use TypeScript",
    botAction: "❌ Won't respond (not mentioned/replied)",
  },
  {
    situation: "DM - Someone mentions Eden",
    message: "Eden, help me with something",
    botAction: "✅ Will respond (mentioned)",
  },
  {
    situation: "Group Chat - Owner mentions bot",
    message: "Ansh says: Eden, status check",
    botAction: "✅ Will respond with special treatment (owner + mentioned)",
  },
];

scenarios.forEach((scenario, index) => {
  console.log(`${index + 1}. ${scenario.situation}`);
  console.log(`   Message: "${scenario.message}"`);
  console.log(`   Bot: ${scenario.botAction}`);
  console.log("");
});

console.log("💡 Note: Bot has 80% probability of responding by default");
console.log("   This prevents spam in active group chats");
console.log("\n✨ Test completed successfully!");
