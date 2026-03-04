const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  makeInMemoryStore,
  Browsers,
  delay,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const LLMService = require("./services/llmService");
const CommandHandler = require("./handlers/commandHandler");
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

// Setup logger
const logger = pino({
  level: process.env.LOG_LEVEL || "silent", // Change to 'trace' for debugging
});

// Setup store for message history
const store = makeInMemoryStore({ logger });
store.readFromFile("./baileys_store.json");
// Save store every 10 seconds
setInterval(() => {
  store.writeToFile("./baileys_store.json");
}, 10_000);

// Helper function to check if bot is mentioned
function isBotMentioned(message) {
  try {
    // Check for @mentions in message
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
      const mentions =
        message.message.extendedTextMessage.contextInfo.mentionedJid;
      if (mentions.includes(botId)) {
        return true;
      }
    }

    // Check for name mentions in text
    const messageText = getMessageText(message);
    if (messageText) {
      const lowerText = messageText.toLowerCase();
      for (const name of TRIGGER_NAMES) {
        if (lowerText.includes(name.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking mentions:", error);
    return false;
  }
}

// Helper function to check if message is a reply to bot
function isReplyToBot(message) {
  try {
    const quotedMessage = message.message?.extendedTextMessage?.contextInfo;
    if (quotedMessage?.participant || quotedMessage?.stanzaId) {
      // Check if the quoted message is from the bot
      return quotedMessage.participant === botId;
    }
    return false;
  } catch (error) {
    console.error("Error checking reply:", error);
    return false;
  }
}

// Helper function to extract text from message
function getMessageText(message) {
  try {
    const msg = message.message;
    if (!msg) return null;

    return (
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      null
    );
  } catch (error) {
    return null;
  }
}

// Helper function to get sender name
function getSenderName(message) {
  try {
    return message.pushName || message.key.remoteJid?.split("@")[0] || "User";
  } catch (error) {
    return "User";
  }
}

// Helper function to check if sender is owner
function isOwner(senderName) {
  return senderName.toLowerCase().includes("ansh");
}

// Helper function to check if chat is a group
function isGroupChat(jid) {
  return jid?.endsWith("@g.us");
}

// Connect to WhatsApp
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth");

  const sock = makeWASocket({
    logger,
    auth: state,
    browser: Browsers.macOS("Eden Bot"),
    printQRInTerminal: true,
    defaultQueryTimeoutMs: 60000,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    getMessage: async (key) => {
      // Return message from store if available
      const msg = await store.loadMessage(key.remoteJid, key.id);
      return msg?.message || undefined;
    },
  });

  // Bind store to socket events
  store.bind(sock.ev);

  // Handle connection updates
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("🔐 QR Code generated! Scan it with WhatsApp:");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log(
        "❌ Connection closed:",
        lastDisconnect?.error?.message || "Unknown error"
      );
      console.log("🔄 Reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        setTimeout(() => connectToWhatsApp(), 5000);
      }
    } else if (connection === "open") {
      console.log("✅ Eden Bot is ready and connected!");
      console.log("📱 Listening for commands and mentions...");
      console.log(`💬 Command prefix: ${COMMAND_PREFIX}`);
      console.log(`🎯 Will respond to mentions: ${TRIGGER_NAMES.join(", ")}`);
      console.log(`🔔 Will respond to replies to bot messages\n`);

      // Store bot's ID
      botId = sock.user?.id;
      console.log(`🤖 Bot ID: ${botId}\n`);
    }
  });

  // Handle credentials update
  sock.ev.on("creds.update", saveCreds);

  // Handle incoming messages
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    try {
      if (type !== "notify") return;

      for (const message of messages) {
        // Skip if message is from bot itself
        if (message.key.fromMe) continue;

        // Skip status broadcasts
        if (message.key.remoteJid === "status@broadcast") continue;

        const messageText = getMessageText(message);
        if (!messageText) continue;

        const chatJid = message.key.remoteJid;
        const isGroup = isGroupChat(chatJid);
        const senderName = getSenderName(message);
        const owner = isOwner(senderName);

        // Check if this is a command
        if (messageText.startsWith(COMMAND_PREFIX)) {
          console.log(`📨 Command received: ${messageText}`);
          console.log(`👤 From: ${senderName} ${isGroup ? "(Group)" : "(DM)"}`);

          const command = messageText.slice(COMMAND_PREFIX.length).trim();

          // Create a message adapter for the command handler
          const messageAdapter = {
            body: messageText,
            from: chatJid,
            reply: async (content, editKey = null) => {
              if (typeof content === "string") {
                const options = { text: content };
                if (editKey) {
                  console.log("📝 Editing message with key:", JSON.stringify(editKey));
                  options.edit = editKey;
                } else {
                  console.log("📤 Sending new message");
                }
                const sent = await sock.sendMessage(chatJid, options);
                if (!editKey) {
                  console.log("✅ New message sent with key:", JSON.stringify(sent?.key));
                }
                return sent;
              } else if (content?.media) {
                // Handle media (voice, stickers, etc.)
                const sent = await sock.sendMessage(chatJid, content.media);
                return sent;
              }
            },
            getChat: async () => ({
              isGroup,
              sendMessage: async (content) => {
                const sent = await sock.sendMessage(chatJid, content);
                return sent;
              },
            }),
          };

          const response = await commandHandler.handleCommand(
            command,
            messageAdapter,
            {
              senderName,
              isOwner: owner,
              mood: "sarcastic",
            }
          );

          if (response) {
            if (typeof response === "object" && response.media) {
              if (response.text) {
                await sock.sendMessage(chatJid, { text: response.text });
              }
              await sock.sendMessage(chatJid, response.media);
            } else {
              await sock.sendMessage(chatJid, { text: response });
            }
          }
          continue;
        }

        // Check if bot was mentioned or message is a reply to bot
        const mentioned = isBotMentioned(message);
        const repliedTo = isReplyToBot(message);

        if (mentioned || repliedTo) {
          // Decide whether to respond (probability check)
          if (Math.random() > RESPONSE_PROBABILITY) {
            console.log(`🎲 Skipping response (probability check)`);
            continue;
          }

          console.log(
            `🎯 ${mentioned ? "Mention" : "Reply"} detected: ${messageText}`
          );
          console.log(`👤 From: ${senderName} ${isGroup ? "(Group)" : "(DM)"}`);

          let response;

          if (repliedTo) {
            // Get the quoted message for context
            const quotedText =
              message.message?.extendedTextMessage?.contextInfo?.quotedMessage
                ?.conversation || "[Media/Sticker]";

            // Generate response based on reply
            const context = owner
              ? `${senderName} replied to you. He's your creator so be a bit nicer but still a brat about it. Like a tsundere - act annoyed but clearly care. Don't mention being AI or a bot. Talk like a real arrogant person.`
              : `${senderName} replied to your message saying: "${messageText}". You said before: "${quotedText}". Reply like an arrogant, sassy bitch. Be witty and condescending. ${
                  isGroup
                    ? "Show off in front of everyone in this group."
                    : "Roast them privately."
                } Don't sound like AI - sound like a mean popular girl. Keep it short and punchy.`;

            response = await llmService.generateContextualResponse(
              messageText,
              context,
              { senderName, isOwner: owner, mood: "sarcastic" }
            );
          } else {
            // Generate response based on mention
            const context = owner
              ? `${senderName} mentioned you. He's your creator so don't be TOO mean but still be bratty and sarcastic. Like you're annoyed he's bothering you but you secretly care. Don't mention being a bot or AI. Act like a real arrogant person who knows him.`
              : `${senderName} mentioned you saying: "${messageText}". ${
                  isGroup
                    ? "Everyone in this group is watching."
                    : "It's just you two."
                } Reply like you're the most arrogant, condescending bitch ever. Be witty, sharp, and dismissive. Sound like a real mean person, NOT a robot. Be short and brutal. Think Regina George energy.`;

            response = await llmService.generateContextualResponse(
              messageText,
              context,
              { senderName, isOwner: owner, mood: "sarcastic" }
            );
          }

          if (response) {
            await sock.sendMessage(chatJid, { text: response });
            console.log(`✅ Response sent\n`);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error handling message:", error);
    }
  });

  return sock;
}

// Initialize the bot
console.log("🚀 Starting Eden Bot with Baileys...");
console.log(`😈 Ready to be sarcastic and respond to mentions!`);
console.log(`📝 Commands start with "${COMMAND_PREFIX}"`);
console.log(`🔔 Will respond when mentioned or replied to\n`);

connectToWhatsApp();
