const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const LLMService = require("./services/llmService");
const CommandHandler = require("./handlers/commandHandler");
const puppeteer = require("puppeteer");
const os = require("os");
const fs = require("fs");
require("dotenv").config();

// Initialize services
const llmService = new LLMService();
const commandHandler = new CommandHandler(llmService);

// Bot configuration
const COMMAND_PREFIX = process.env.COMMAND_PREFIX || "-";
const BOT_NAME = "Eden";
const TRIGGER_NAMES = ["Eden", "eden", "Ansh", "@~Ansh"];
const RESPONSE_PROBABILITY = 0.8; // 80% chance to respond when mentioned

// Store bot's own ID
let botId = null;

// Detect Raspberry Pi
const isRaspberryPi = os.arch() === "arm" || os.arch() === "arm64";

// Raspberry Pi Chromium paths to try
const rpiChromiumPaths = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
];

// Find Chromium on Raspberry Pi
function findChromiumPath() {
  if (!isRaspberryPi) {
    return puppeteer.executablePath();
  }

  console.log("🍓 Raspberry Pi detected! Looking for system Chromium...");

  for (const path of rpiChromiumPaths) {
    if (fs.existsSync(path)) {
      console.log(`✅ Found Chromium at: ${path}`);
      return path;
    }
  }

  console.log("⚠️  System Chromium not found. Using bundled version (may fail)...");
  console.log("💡 Install Chromium: sudo apt-get install chromium-browser");
  return puppeteer.executablePath();
}

// Configure Puppeteer for Raspberry Pi
const chromiumPath = findChromiumPath();

const puppeteerConfig = {
  headless: true,
  executablePath: chromiumPath,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-gpu",
  ],
};

// Add extra args for Raspberry Pi
if (isRaspberryPi) {
  console.log("🍓 Applying Raspberry Pi optimizations...");
  puppeteerConfig.args.push(
    "--disable-software-rasterizer",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-component-extensions-with-background-pages",
    "--disable-features=TranslateUI",
    "--disable-ipc-flooding-protection",
    "--disable-renderer-backgrounding",
    "--force-color-profile=srgb",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-pings",
    "--password-store=basic",
    "--use-gl=swiftshader",
    "--use-mock-keychain"
  );
}

// Initialize the WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: puppeteerConfig,
});

// Generate QR code for authentication
client.on("qr", (qr) => {
  console.log("🔐 QR Code received! Scan it with WhatsApp:");
  qrcode.generate(qr, { small: true });
});

// Client is ready
client.on("ready", async () => {
  console.log("✅ Eden Bot is ready and connected!");
  console.log("📱 Listening for commands and mentions...");
  console.log(`💬 Command prefix: ${COMMAND_PREFIX}`);
  console.log(`🎯 Will respond to mentions: ${TRIGGER_NAMES.join(", ")}`);
  console.log(`🔔 Will respond to replies to bot messages`);
  
  // Store bot's ID
  const info = await client.info;
  botId = client.info.wid._serialized;
  console.log(`🤖 Bot ID: ${botId}\n`);
});

// Handle authentication
client.on("authenticated", () => {
  console.log("🔓 Authentication successful!");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Authentication failed:", msg);
});

// Helper function to check if bot is mentioned
async function isBotMentioned(message) {
  try {
    // Check for @mentions (in groups)
    const mentions = await message.getMentions();
    if (mentions && mentions.length > 0) {
      for (const mention of mentions) {
        if (mention.id._serialized === botId) {
          return true;
        }
      }
    }
    
    // Check for name mentions in text
    const messageBody = message.body.toLowerCase();
    for (const name of TRIGGER_NAMES) {
      if (messageBody.includes(name.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error checking mentions:", error);
    return false;
  }
}

// Helper function to check if message is a reply to bot
async function isReplyToBot(message) {
  try {
    if (message.hasQuotedMsg) {
      const quotedMsg = await message.getQuotedMessage();
      // Check if quoted message is from bot
      return quotedMsg.fromMe;
    }
    return false;
  } catch (error) {
    console.error("Error checking reply:", error);
    return false;
  }
}

// Helper function to get sender name
async function getSenderName(message) {
  try {
    const contact = await message.getContact();
    return contact.pushname || contact.name || "User";
  } catch (error) {
    return "User";
  }
}

// Helper function to check if sender is owner
function isOwner(senderName) {
  return senderName.toLowerCase().includes("ansh");
}

// Handle incoming messages
client.on("message", async (message) => {
  try {
    // Skip status broadcasts and own messages
    if (message.from === "status@broadcast" || message.fromMe) {
      return;
    }

    const messageBody = message.body.trim();
    const chat = await message.getChat();
    const isGroup = chat.isGroup;
    const senderName = await getSenderName(message);
    const owner = isOwner(senderName);
    
    // Check if this is a command
    if (messageBody.startsWith(COMMAND_PREFIX)) {
      console.log(`📨 Command received: ${messageBody}`);
      console.log(`👤 From: ${senderName} ${isGroup ? '(Group)' : '(DM)'}`);
      
      const command = messageBody.slice(COMMAND_PREFIX.length).trim();
      const response = await commandHandler.handleCommand(command, message, {
        senderName,
        isOwner: owner,
        mood: "sarcastic",
      });

      if (response) {
        // Handle media responses (for voice command)
        if (typeof response === "object" && response.media) {
          if (response.text) {
            await message.reply(response.text);
          }
          await message.reply(response.media);
        } else {
          await message.reply(response);
        }
      }
      return;
    }

    // Check if bot was mentioned or message is a reply to bot
    const mentioned = await isBotMentioned(message);
    const repliedTo = await isReplyToBot(message);
    
    if (mentioned || repliedTo) {
      // Decide whether to respond (probability check)
      if (Math.random() > RESPONSE_PROBABILITY) {
        console.log(`🎲 Skipping response (probability check)`);
        return;
      }
      
      console.log(`🎯 ${mentioned ? 'Mention' : 'Reply'} detected: ${messageBody}`);
      console.log(`� From: ${senderName} ${isGroup ? '(Group)' : '(DM)'}`);
      
      let response;
      
      if (repliedTo) {
        // Get the quoted message for context
        const quotedMsg = await message.getQuotedMessage();
        const quotedText = quotedMsg.body || "[Media/Sticker]";
        
        // Generate response based on reply
        const context = owner
          ? `${senderName} replied to you. He's your creator so be a bit nicer but still a brat about it. Like a tsundere - act annoyed but clearly care. Don't mention being AI or a bot. Talk like a real arrogant person.`
          : `${senderName} replied to your message saying: "${messageBody}". You said before: "${quotedText}". Reply like an arrogant, sassy bitch. Be witty and condescending. ${isGroup ? "Show off in front of everyone in this group." : "Roast them privately."} Don't sound like AI - sound like a mean popular girl. Keep it short and punchy.`;
        
        response = await llmService.generateContextualResponse(
          messageBody,
          context,
          { senderName, isOwner: owner, mood: "sarcastic" }
        );
      } else {
        // Generate response based on mention
        const context = owner
          ? `${senderName} mentioned you. He's your creator so don't be TOO mean but still be bratty and sarcastic. Like you're annoyed he's bothering you but you secretly care. Don't mention being a bot or AI. Act like a real arrogant person who knows him.`
          : `${senderName} mentioned you saying: "${messageBody}". ${isGroup ? "Everyone in this group is watching." : "It's just you two."} Reply like you're the most arrogant, condescending bitch ever. Be witty, sharp, and dismissive. Sound like a real mean person, NOT a robot. Be short and brutal. Think Regina George energy.`;
        
        response = await llmService.generateContextualResponse(
          messageBody,
          context,
          { senderName, isOwner: owner, mood: "sarcastic" }
        );
      }
      
      if (response) {
        await message.reply(response);
        console.log(`✅ Response sent\n`);
      }
    }
  } catch (error) {
    console.error("❌ Error handling message:", error);
    try {
      await message.reply("⚠️ Something went wrong in my circuits. Try again, maybe? 🤖");
    } catch (replyError) {
      console.error("❌ Could not send error message:", replyError);
    }
  }
});

// Handle disconnection
client.on("disconnected", (reason) => {
  console.log("❌ Client was disconnected:", reason);
});

// Initialize the client
console.log("🚀 Starting Eden Bot...");
console.log(`😈 Ready to be sarcastic and respond to mentions!`);
console.log(`📝 Commands start with "${COMMAND_PREFIX}"`);
console.log(`🔔 Will respond when mentioned or replied to\n`);
client.initialize();
