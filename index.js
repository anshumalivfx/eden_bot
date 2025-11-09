const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  delay,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const readline = require("readline");
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
  try {
    const { state, saveCreds } = await useMultiFileAuthState("baileys_auth");

    // Fetch latest Baileys version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`🔧 Using WA v${version.join(".")}, isLatest: ${isLatest}`);

    console.log("🔧 Initializing Baileys socket...");

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          pino({ level: "silent" })
        ),
      },
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      getMessage: async (key) => {
        return { conversation: "" };
      },
    });

    console.log("✅ Socket created successfully\n");

    // Handle connection updates
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Display QR code when received
      if (qr) {
        console.log("\n🔐 QR Code received! Scan it with WhatsApp:\n");
        qrcode.generate(qr, { small: true });
        console.log(
          "\n📱 Open WhatsApp → Settings → Linked Devices → Link a Device"
        );
        console.log("⏰ QR code will refresh automatically if not scanned\n");
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log("❌ Connection closed");
        console.log(
          "   Error:",
          lastDisconnect?.error?.message || "Unknown error"
        );
        console.log("   Status Code:", statusCode);
        console.log("   Should Reconnect:", shouldReconnect);

        if (shouldReconnect) {
          console.log("⏳ Waiting 5 seconds before reconnecting...\n");
          setTimeout(() => connectToWhatsApp(), 5000);
        } else {
          console.log("🚪 Logged out - please restart and scan QR again\n");
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
      } else if (connection === "connecting") {
        console.log("🔌 Connecting to WhatsApp...");
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
            console.log(
              `👤 From: ${senderName} ${isGroup ? "(Group)" : "(DM)"}`
            );

            const command = messageText.slice(COMMAND_PREFIX.length).trim();

            // Create a message adapter for the command handler (compatible with old API)
            const messageAdapter = {
              body: messageText,
              from: chatJid,
              hasQuotedMsg: message.message?.extendedTextMessage?.contextInfo
                ?.quotedMessage
                ? true
                : false,
              getQuotedMessage: async () => {
                const contextInfo =
                  message.message?.extendedTextMessage?.contextInfo;
                if (contextInfo?.quotedMessage) {
                  return {
                    body:
                      contextInfo.quotedMessage.conversation ||
                      contextInfo.quotedMessage.extendedTextMessage?.text ||
                      "",
                    fromMe: contextInfo.participant === botId,
                  };
                }
                return null;
              },
              hasMedia: !!(
                message.message?.imageMessage ||
                message.message?.videoMessage ||
                message.message?.stickerMessage
              ),
              downloadMedia: async () => {
                // This is a simplified version - you may need to implement full media download
                return null;
              },
              reply: async (content) => {
                if (typeof content === "string") {
                  await sock.sendMessage(chatJid, { text: content });
                } else if (content?.media) {
                  // Handle different media types
                  if (content.text) {
                    await sock.sendMessage(chatJid, { text: content.text });
                  }
                  await sock.sendMessage(chatJid, content.media);
                }
              },
              getChat: async () => ({
                isGroup,
                sendMessage: async (content) => {
                  await sock.sendMessage(chatJid, content);
                },
              }),
              getContact: async () => ({
                pushname: senderName,
                name: senderName,
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
                  await sock.sendMessage(chatJid, {
                    text: response.text,
                    quoted: message,
                  });
                }
                await sock.sendMessage(chatJid, {
                  ...response.media,
                  quoted: message,
                });
              } else {
                await sock.sendMessage(chatJid, {
                  text: response,
                  quoted: message,
                });
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
            console.log(
              `👤 From: ${senderName} ${isGroup ? "(Group)" : "(DM)"}`
            );

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
  } catch (error) {
    console.error("❌ Fatal error in connectToWhatsApp:", error);
    console.error("   Error details:", error.message);
    console.error("   Stack:", error.stack);
    console.log("\n⏳ Waiting 10 seconds before retrying...\n");
    setTimeout(() => connectToWhatsApp(), 10000);
  }
}

// Initialize the bot
console.log("🚀 Starting Eden Bot with Baileys...");
console.log(`😈 Ready to be sarcastic and respond to mentions!`);
console.log(`📝 Commands start with "${COMMAND_PREFIX}"`);
console.log(`🔔 Will respond when mentioned or replied to\n`);

connectToWhatsApp();
