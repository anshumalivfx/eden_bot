const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const LLMService = require("./services/llmService");
const CommandHandler = require("./handlers/commandHandler");
require("dotenv").config();

class WhatsAppBot {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
        ],
      },
    });

    this.llmService = new LLMService();
    this.commandHandler = new CommandHandler(this.llmService);

    // New features
    this.triggerNames = (process.env.TRIGGER_NAMES || "Eden")
      .split(",")
      .map((name) => name.trim());
    this.ownerName = process.env.OWNER_NAME || "Ansh";
    this.triggerProbability = parseFloat(
      process.env.TRIGGER_PROBABILITY || "0.8"
    );
    this.enableRandomMessages = process.env.ENABLE_RANDOM_MESSAGES === "true";
    this.enableMoodSystem = process.env.ENABLE_MOOD_SYSTEM === "true";
    this.enableRoastReactions = process.env.ENABLE_ROAST_REACTIONS === "true";
    this.enableSmartContext = process.env.ENABLE_SMART_CONTEXT === "true";

    // Mood system
    this.currentMood = "sarcastic"; // sarcastic, savage, playful, annoyed
    this.moodTimer = null;

    this.initializeEventHandlers();
  }

  initializeEventHandlers() {
    // QR Code for authentication
    this.client.on("qr", (qr) => {
      console.log("🔗 Scan this QR code with your WhatsApp:");
      qrcode.generate(qr, { small: true });
    });

    // Bot ready
    this.client.on("ready", () => {
      console.log("✅ Eden is ready to be mean!");

      // Start mood system
      if (this.enableMoodSystem) {
        this.changeMood();
        console.log("🎭 Mood system activated");
      }
    });

    // Handle incoming messages
    this.client.on("message", async (message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        console.error("Error handling message:", error);
      }
    });

    // Handle authentication failures
    this.client.on("auth_failure", (msg) => {
      console.error("❌ Authentication failed:", msg);
    });

    // Handle disconnections
    this.client.on("disconnected", (reason) => {
      console.log("📱 Client was logged out:", reason);
    });
  }

  async handleMessage(message) {
    // Skip if message is from status broadcast or if it's from the bot itself
    if (message.from === "status@broadcast" || message.fromMe) {
      return;
    }

    const messageBody = message.body.trim();
    const commandPrefix = process.env.COMMAND_PREFIX || "-";

    // Get contact info for personalization
    const contact = await message.getContact();
    const senderName = contact.pushname || contact.name || "Unknown";
    const isOwner = senderName
      .toLowerCase()
      .includes(this.ownerName.toLowerCase());

    // Check if message starts with command prefix
    if (messageBody.startsWith(commandPrefix)) {
      console.log(`📨 Command received: ${messageBody}`);
      console.log(`👤 From: ${senderName}`);

      const command = messageBody.slice(1).trim();
      const response = await this.commandHandler.handleCommand(
        command,
        message,
        {
          senderName,
          isOwner,
          mood: this.currentMood,
        }
      );

      if (response) {
        // Handle media responses (for voice command)
        if (typeof response === "object" && response.media) {
          if (response.text) {
            await message.reply(response.text);
          }
          await message.reply(response.media);
        } else {
          // Handle regular text responses
          await message.reply(response);
        }
      }
      return;
    }

    // Check for name mentions (Eden, Ansh, @~Ansh)
    const mentionsEden = this.triggerNames.some((name) =>
      messageBody.toLowerCase().includes(name.toLowerCase())
    );

    if (mentionsEden && Math.random() < this.triggerProbability) {
      console.log(`🎯 Name mention detected: ${messageBody}`);
      console.log(`👤 From: ${senderName}`);

      const response = await this.handleNameMention(
        messageBody,
        senderName,
        isOwner,
        message
      );
      if (response) {
        await message.reply(response);
      }
      return;
    }

    // Random message responses (low probability for fun)
    if (this.enableRandomMessages && Math.random() < 0.05) {
      // 5% chance
      const response = await this.handleRandomMessage(
        messageBody,
        senderName,
        isOwner
      );
      if (response) {
        await message.reply(response);
      }
    }

    // Smart context reactions
    if (this.enableSmartContext) {
      await this.handleContextualReactions(message, messageBody, senderName);
    }
  }

  async handleNameMention(messageBody, senderName, isOwner, message) {
    // Special responses for owner
    if (isOwner) {
      const ownerResponses = await this.llmService.generateContextualResponse(
        messageBody,
        `This is ${this.ownerName}, your creator/owner. Be slightly less mean but still sarcastic. Show some affection but in a tsundere way.`,
        { senderName, mood: this.currentMood }
      );
      return ownerResponses;
    }

    // Regular mention responses
    const context = `Someone mentioned your name "Eden" in a group chat. Respond wittily and sarcastically to their message. Be clever and show personality.`;
    return await this.llmService.generateContextualResponse(
      messageBody,
      context,
      {
        senderName,
        mood: this.currentMood,
      }
    );
  }

  async handleRandomMessage(messageBody, senderName, isOwner) {
    // Occasionally butt into conversations with witty remarks
    const context = `Respond to this random message with a witty, sarcastic comment. Be brief and clever. Act like you're eavesdropping on the conversation.`;
    return await this.llmService.generateContextualResponse(
      messageBody,
      context,
      {
        senderName,
        mood: this.currentMood,
        isRandom: true,
      }
    );
  }

  async handleContextualReactions(message, messageBody, senderName) {
    // React to specific types of messages
    const reactions = {
      "good morning": "🌅 Oh look, someone discovered mornings exist...",
      "good night": "🌙 Finally, some peace and quiet.",
      hello: "👋 Well well, look who learned basic greetings.",
      thanks: "🙄 You're welcome, I guess.",
      sorry: "😏 At least you're self-aware.",
      help: "🆘 Have you tried Google? Revolutionary concept.",
      lol: "😂 Glad my existence amuses you.",
      wtf: "🤔 My thoughts exactly.",
      why: "🤷‍♀️ Because the universe has a sense of humor.",
      how: "📚 Step 1: Use your brain. Step 2: Repeat step 1.",
    };

    const lowerMessage = messageBody.toLowerCase();
    for (const [trigger, reaction] of Object.entries(reactions)) {
      if (lowerMessage.includes(trigger) && Math.random() < 0.3) {
        // 30% chance
        setTimeout(() => {
          message.reply(reaction);
        }, Math.random() * 3000 + 1000); // Random delay 1-4 seconds
        break;
      }
    }
  }

  changeMood() {
    const moods = ["sarcastic", "savage", "playful", "annoyed", "dramatic"];
    this.currentMood = moods[Math.floor(Math.random() * moods.length)];
    console.log(`😈 Eden's mood changed to: ${this.currentMood}`);

    // Schedule next mood change (15-30 minutes)
    if (this.moodTimer) clearTimeout(this.moodTimer);
    this.moodTimer = setTimeout(() => {
      this.changeMood();
    }, (Math.random() * 15 + 15) * 60000);
  }

  async start() {
    try {
      console.log("🚀 Starting Eden - Your Sarcastic WhatsApp Companion...");
      await this.client.initialize();
    } catch (error) {
      console.error("❌ Failed to start Eden:", error);
    }
  }
}

// Start the bot
const bot = new WhatsAppBot();
bot.start();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("🛑 Shutting down Eden...");
  process.exit(0);
});
