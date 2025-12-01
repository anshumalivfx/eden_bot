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
const fs = require("fs");
const path = require("path");
const LLMService = require("./services/llmService");
const CommandHandler = require("./handlers/commandHandler");
const MessageStore = require("./database/messageStore");
require("dotenv").config();

// Load nice users configuration
let niceUsersConfig = { niceUsers: [] };
const niceUsersPath = path.join(__dirname, "nice-users.json");
try {
  const data = fs.readFileSync(niceUsersPath, "utf8");
  niceUsersConfig = JSON.parse(data);
  console.log(
    `✅ Loaded ${niceUsersConfig.niceUsers.length} nice users from config`
  );
} catch (error) {
  console.log("⚠️ No nice-users.json found, using default behavior");
}

// Helper to check if user should be treated nicely
function isNiceUser(jid) {
  if (!jid) return false;
  // Extract just the number part from JID (removes @s.whatsapp.net, @lid, etc)
  const numberPart = jid.split("@")[0].replace(/[^0-9]/g, "");
  const result = niceUsersConfig.niceUsers.some((user) => {
    const configNumber = user.jid.replace(/[^0-9]/g, "");
    return (
      numberPart.includes(configNumber) || configNumber.includes(numberPart)
    );
  });
  console.log(`🔍 Nice user check: ${jid} -> ${numberPart} -> ${result}`);
  return result;
}

// Helper to get nice user info
function getNiceUserInfo(jid) {
  if (!jid) return null;
  const numberPart = jid.split("@")[0].replace(/[^0-9]/g, "");
  return niceUsersConfig.niceUsers.find((user) => {
    const configNumber = user.jid.replace(/[^0-9]/g, "");
    return (
      numberPart.includes(configNumber) || configNumber.includes(numberPart)
    );
  });
}

// Initialize services
const llmService = new LLMService();
const commandHandler = new CommandHandler(llmService);

// Bot configuration
const COMMAND_PREFIX = process.env.COMMAND_PREFIX || "-";
const BOT_NAME = "Eden";
const TRIGGER_NAMES = ["Eden", "eden", "Ansh", "@~Ansh", "@~Eden"];
const RESPONSE_PROBABILITY = 0.8; // 80% chance to respond when mentioned

// Store bot's own ID
let botId = null;
let botLid = null; // Bot's LID in groups

// Contact name cache for mentions
// Maps JID -> display name from pushName or message text
const contactNameCache = new Map();

// Initialize SQLite message store for persistent context
const messageStore = new MessageStore();

// Helper to add message to context store
function addMessageToContext(
  chatId,
  sender,
  message,
  isBot = false,
  messageId = null,
  senderJid = null
) {
  messageStore.addMessage(chatId, sender, message, isBot, messageId, senderJid);
}

// Helper to get conversation context (filtered by specific user)
function getConversationContext(chatId, targetUser = null, limit = 15) {
  // Get messages from SQLite database
  const contextMessages = messageStore.getContext(chatId, targetUser, limit);

  // Debug: Show conversation history being used
  console.log(
    `\n💬 Retrieved ${contextMessages.length} context messages for ${
      targetUser || "all users"
    }:`
  );
  contextMessages.forEach((m, i) => {
    // Safety check for undefined message
    const messageText = m.message || "[empty message]";
    const preview = messageText.substring(0, 60);
    console.log(
      `   ${i + 1}. ${m.is_bot ? "Eden" : m.sender_name}: ${preview}${
        messageText.length > 60 ? "..." : ""
      }`
    );
  });
  console.log("");

  return contextMessages
    .map(
      (m) =>
        `${m.is_bot ? "Eden" : m.sender_name}: ${m.message || "[no message]"}`
    )
    .join("\n");
}

// Message wrapper class
class MessageWrapper {
  constructor(rawMessage, sock, botName = "eden") {
    // Raw message object
    this.raw = rawMessage;
    this.sock = sock;

    // Extract message content
    this.content = this.extractContent(rawMessage.message);

    // Extract user IDs - handle both group and DM
    const remoteJid = rawMessage.key.remoteJid;
    const participant = rawMessage.key.participant;

    // userId is the actual sender (participant in group, remoteJid in DM)
    this.userId = participant || remoteJid;
    this.number = this.userId?.split("@")[0];

    // LID support - check if sender uses LID
    this.lid = this.userId?.endsWith("@lid") ? this.userId : undefined;

    // oldId is the c.us format (WhatsApp Web legacy format)
    this.oldId = this.number ? `${this.number}@c.us` : undefined;

    // Group ID if in a group
    this.groupId = remoteJid?.endsWith("@g.us") ? remoteJid : undefined;

    // Push name (display name)
    this.pushName = rawMessage.pushName || "";

    // Extract mentions from message
    this.mentions =
      rawMessage.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Message metadata
    this.isFromMe = rawMessage.key.fromMe || false;
    this.timestamp = new Date((rawMessage.messageTimestamp || 0) * 1000);

    // Check for quoted/reply message
    this.quoted = this.extractQuoted(rawMessage.message);

    // Message type checks
    this.isSticker = !!rawMessage.message?.stickerMessage;
    this.isStatusMention = remoteJid === "status@broadcast";
    this.isViewOnce = !!(
      rawMessage.message?.viewOnceMessage ||
      rawMessage.message?.viewOnceMessageV2
    );
    this.isReaction = !!rawMessage.message?.reactionMessage;
    this.isLocationMessage = !!rawMessage.message?.locationMessage;

    // Bot name
    this.botName = botName;
  }

  extractContent(msg) {
    if (!msg) return "";

    // Handle different message types
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    if (msg.documentMessage?.caption) return msg.documentMessage.caption;

    return "";
  }

  extractQuoted(msg) {
    const contextInfo =
      msg?.extendedTextMessage?.contextInfo ||
      msg?.imageMessage?.contextInfo ||
      msg?.videoMessage?.contextInfo;

    if (contextInfo?.quotedMessage) {
      const quoted = contextInfo.quotedMessage;
      const participant = contextInfo.participant;

      return {
        userId: participant,
        number: participant?.split("@")[0],
        lid: participant?.endsWith("@lid") ? participant : undefined,
        content: this.extractContent(quoted),
        stanzaId: contextInfo.stanzaId,
        raw: quoted,
      };
    }
    return undefined;
  }

  // Reply to this message
  async reply(text, quotedMsg, mentions = []) {
    const options = {};
    if (quotedMsg || this.raw) {
      options.quoted = quotedMsg || this.raw;
    }

    await this.sock.sendMessage(
      this.groupId || this.userId,
      { text, mentions },
      options
    );
  }

  // Check if message has media
  get hasMedia() {
    const msg = this.raw.message;
    return !!(
      msg?.imageMessage ||
      msg?.videoMessage ||
      msg?.audioMessage ||
      msg?.documentMessage ||
      msg?.stickerMessage
    );
  }

  // Check if has quoted message
  get hasQuotedMsg() {
    return !!this.quoted;
  }

  // Get message body (alias for content)
  get body() {
    return this.content;
  }

  // Get sender JID
  get from() {
    return this.groupId || this.userId;
  }

  // Download media from this message
  async downloadMedia() {
    if (!this.hasMedia) return null;

    try {
      const { downloadMediaMessage } = require("@whiskeysockets/baileys");
      const buffer = await downloadMediaMessage(this.raw, "buffer", {});

      const msg = this.raw.message;
      let mimetype = "application/octet-stream";
      let filename = `media_${Date.now()}`;

      if (msg.imageMessage) {
        mimetype = msg.imageMessage.mimetype || "image/jpeg";
        filename = `image_${Date.now()}.jpg`;
      } else if (msg.videoMessage) {
        mimetype = msg.videoMessage.mimetype || "video/mp4";
        filename = `video_${Date.now()}.mp4`;
      } else if (msg.audioMessage) {
        mimetype = msg.audioMessage.mimetype || "audio/ogg";
        filename = `audio_${Date.now()}.ogg`;
      } else if (msg.documentMessage) {
        mimetype = msg.documentMessage.mimetype || "application/pdf";
        filename = msg.documentMessage.fileName || `document_${Date.now()}`;
      } else if (msg.stickerMessage) {
        mimetype = "image/webp";
        filename = `sticker_${Date.now()}.webp`;
      }

      return {
        data: buffer.toString("base64"),
        buffer: buffer,
        mimetype: mimetype,
        filename: filename,
      };
    } catch (error) {
      console.error("Error downloading media:", error);
      return null;
    }
  }

  // Get quoted message
  async getQuotedMessage() {
    if (!this.quoted) return null;

    return {
      body: this.quoted.content,
      fromMe: false,
      hasMedia: false, // We can enhance this later if needed
      downloadMedia: async () => {
        // Try to download media from quoted message
        if (!this.quoted.raw) return null;

        try {
          const { downloadMediaMessage } = require("@whiskeysockets/baileys");
          const quotedMsgObj = {
            key: {
              remoteJid: this.groupId || this.userId,
              fromMe: false,
              id: this.quoted.stanzaId,
            },
            message: this.quoted.raw,
          };

          const buffer = await downloadMediaMessage(quotedMsgObj, "buffer", {});

          return {
            data: buffer.toString("base64"),
            buffer: buffer,
            mimetype: "application/octet-stream",
            filename: `quoted_media_${Date.now()}`,
          };
        } catch (error) {
          console.error("Error downloading quoted media:", error);
          return null;
        }
      },
    };
  }

  // Backward compatibility method for old API
  async getMentions() {
    const mentionedJids = this.mentions;
    const mentions = [];

    if (!mentionedJids || mentionedJids.length === 0) {
      return mentions;
    }

    // Get group participants if needed
    let groupParticipants = [];
    if (this.groupId) {
      try {
        const groupMetadata = await this.sock.groupMetadata(this.groupId);
        groupParticipants = groupMetadata.participants || [];
      } catch (e) {
        console.error("Error fetching group metadata:", e.message);
      }
    }

    // Process each mentioned JID
    for (const jid of mentionedJids) {
      let displayName = null;
      let phoneNumber = jid.split("@")[0];
      const isLid = jid.endsWith("@lid");

      // For LID, find corresponding phone number
      if (isLid && groupParticipants.length > 0) {
        const participant = groupParticipants.find((p) => p.lid === jid);
        if (participant) {
          if (participant.phoneNumber) {
            phoneNumber = participant.phoneNumber.split("@")[0];
          } else if (participant.id) {
            phoneNumber = participant.id.split("@")[0];
          }

          // Check cache for name
          if (participant.id && contactNameCache.has(participant.id)) {
            displayName = contactNameCache.get(participant.id);
          }
        }
      }

      // Check cache for current JID
      if (!displayName && contactNameCache.has(jid)) {
        displayName = contactNameCache.get(jid);
      }

      mentions.push({
        jid,
        id: { user: phoneNumber, _serialized: jid },
        number: phoneNumber,
        pushname: displayName,
        name: displayName,
      });
    }

    return mentions;
  }
}

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
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo || !contextInfo.quotedMessage) return false;

    // Check if the quoted message has fromMe flag (Baileys way)
    const quotedKey = contextInfo.stanzaId;
    const quotedParticipant = contextInfo.participant;

    console.log(
      `🔍 Reply check: stanzaId=${quotedKey}, participant=${quotedParticipant}, botId=${botId}, botLid=${botLid}`
    );

    // Method 1: Check if quoted participant matches bot IDs
    if (quotedParticipant) {
      const isBot =
        quotedParticipant === botId || (botLid && quotedParticipant === botLid);
      if (isBot) {
        console.log(`✅ Reply detected via participant match`);
        return true;
      }
    }

    // Method 2: Check message store for this stanzaId to see if it's from bot
    const chatId = message.key.remoteJid;
    const recentMessages = messageStore.getContext(chatId, null, 50);
    const quotedFromBot = recentMessages.some(
      (m) => m.is_bot && m.message_id === quotedKey
    );

    if (quotedFromBot) {
      console.log(`✅ Reply detected via message store`);
      return true;
    }

    // Method 3: In DMs, if there's a quoted message, likely replying to bot
    const isGroup = chatId?.endsWith("@g.us");
    if (!isGroup) {
      console.log(`✅ Reply detected (DM)`);
      return true;
    }

    console.log(`❌ Not a reply to bot`);
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

// Filter ALL console outputs to hide verbose Baileys session messages
const shouldFilterMessage = (args) => {
  const message = args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (typeof arg === "object") return JSON.stringify(arg);
      return String(arg);
    })
    .join(" ");

  return (
    message.includes("Closing stale open session") ||
    message.includes("SessionEntry") ||
    message.includes("Closing session:") ||
    message.includes("pendingPreKey") ||
    message.includes("_chains") ||
    message.includes("registrationId") ||
    message.includes("currentRatchet") ||
    message.includes("ephemeralKeyPair") ||
    message.includes("baseKey") ||
    message.includes("remoteIdentityKey")
  );
};

// Override all console methods
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;
const originalConsoleWarn = console.warn;

console.log = function (...args) {
  if (shouldFilterMessage(args)) return;
  originalConsoleLog.apply(console, args);
};

console.info = function (...args) {
  if (shouldFilterMessage(args)) return;
  originalConsoleInfo.apply(console, args);
};

console.debug = function (...args) {
  if (shouldFilterMessage(args)) return;
  originalConsoleDebug.apply(console, args);
};

console.warn = function (...args) {
  if (shouldFilterMessage(args)) return;
  originalConsoleWarn.apply(console, args);
};

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

        // Clean up duplicate messages on startup
        console.log("🧹 Cleaning up duplicate messages...");
        const removed = messageStore.removeDuplicates();
        if (removed > 0) {
          console.log(`✨ Database cleanup complete!\n`);
        } else {
          console.log(`✨ No duplicates found\n`);
        }
      } else if (connection === "connecting") {
        console.log("🔌 Connecting to WhatsApp...");
      }
    });

    // Handle credentials update
    sock.ev.on("creds.update", saveCreds);

    // Handle message history sync from WhatsApp
    sock.ev.on("messaging-history.set", ({ messages, chats, isLatest }) => {
      console.log(
        `📥 Received message history: ${messages.length} messages from ${chats.length} chats (latest: ${isLatest})`
      );

      // Store messages in SQLite database
      for (const msg of messages) {
        const chatId = msg.key.remoteJid;
        if (!chatId) continue;

        // Extract message content
        let content = "";
        if (msg.message?.conversation) {
          content = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          content = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage?.caption) {
          content = msg.message.imageMessage.caption;
        } else if (msg.message?.videoMessage?.caption) {
          content = msg.message.videoMessage.caption;
        }

        if (content && content.trim().length > 0) {
          const senderJid = msg.key.participant || msg.key.remoteJid;
          const senderName =
            msg.pushName || senderJid?.split("@")[0] || "Unknown";
          const isBot = msg.key.fromMe;
          const messageId = msg.key.id;

          messageStore.addMessage(
            chatId,
            senderName,
            content,
            isBot,
            messageId,
            senderJid
          );
        }
      }

      // Clean old messages (keep last 100 per chat)
      messageStore.cleanOldMessages();

      const stats = messageStore.getStats();
      console.log(
        `💾 Message store: ${stats.totalMessages} messages in ${stats.totalChats} chats`
      );
    });

    // Store new messages as they arrive
    sock.ev.on(
      "messages.upsert",
      async ({ messages: upsertedMessages, type }) => {
        if (type === "notify") {
          for (const msg of upsertedMessages) {
            const chatId = msg.key.remoteJid;

            // Capture bot's LID from its own messages in groups
            if (
              msg.key.fromMe &&
              msg.key.participant &&
              chatId?.endsWith("@g.us") &&
              !botLid
            ) {
              botLid = msg.key.participant;
              console.log(`💾 Captured bot LID from own message: ${botLid}`);
            }

            if (!chatId || msg.key.fromMe) continue;

            // Extract message content
            let content = "";
            if (msg.message?.conversation) {
              content = msg.message.conversation;
            } else if (msg.message?.extendedTextMessage?.text) {
              content = msg.message.extendedTextMessage.text;
            } else if (msg.message?.imageMessage?.caption) {
              content = msg.message.imageMessage.caption;
            } else if (msg.message?.videoMessage?.caption) {
              content = msg.message.videoMessage.caption;
            }

            if (content && content.trim().length > 0) {
              const senderJid = msg.key.participant || msg.key.remoteJid;
              const senderName =
                msg.pushName || senderJid?.split("@")[0] || "Unknown";
              const messageId = msg.key.id;

              messageStore.addMessage(
                chatId,
                senderName,
                content,
                false,
                messageId,
                senderJid
              );
            }
          }
        }
      }
    );

    // Handle contact updates - Baileys emits this when it receives contact info
    sock.ev.on("contacts.update", (updates) => {
      for (const update of updates) {
        if (update.notify || update.name) {
          const displayName = update.notify || update.name;
          // Cache using all possible ID formats
          if (update.id) {
            contactNameCache.set(update.id, displayName);
          }
          if (update.lid) {
            contactNameCache.set(update.lid, displayName);
          }
          if (update.phoneNumber) {
            contactNameCache.set(update.phoneNumber, displayName);
          }
          console.log(
            `📇 Contact updated: ${displayName} (${update.id || update.lid})`
          );
        }
      }
    });

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

          // Cache the pushName for this user for future mentions
          if (message.pushName) {
            const senderJid = message.key.participant || message.key.remoteJid;
            contactNameCache.set(senderJid, message.pushName);
            console.log(`💾 Cached name: ${message.pushName} for ${senderJid}`);

            // Also cache using the phone number JID if this is a LID
            if (senderJid.endsWith("@lid") && isGroup) {
              try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const participant = groupMetadata.participants.find(
                  (p) => p.lid === senderJid
                );
                if (participant && participant.id) {
                  contactNameCache.set(participant.id, message.pushName);
                  console.log(
                    `💾 Also cached for phone JID: ${participant.id}`
                  );
                }
              } catch (e) {
                // Ignore errors
              }
            }
          }

          // Check if this is a command
          if (messageText.startsWith(COMMAND_PREFIX)) {
            console.log(`📨 Command received: ${messageText}`);
            console.log(
              `👤 From: ${senderName} ${isGroup ? "(Group)" : "(DM)"}`
            );

            const command = messageText.slice(COMMAND_PREFIX.length).trim();

            // Create wrapped message with new API
            const msg = new MessageWrapper(
              message,
              sock,
              BOT_NAME.toLowerCase()
            );

            // Log the message structure for debugging
            console.log("📦 Message Object:", {
              content: msg.content,
              userId: msg.userId,
              lid: msg.lid,
              oldId: msg.oldId,
              number: msg.number,
              groupId: msg.groupId,
              pushName: msg.pushName,
              mentions: msg.mentions,
              isFromMe: msg.isFromMe,
              timestamp: msg.timestamp,
              quoted: msg.quoted,
              isSticker: msg.isSticker,
              isStatusMention: msg.isStatusMention,
              isViewOnce: msg.isViewOnce,
              isReaction: msg.isReaction,
              botName: msg.botName,
              isLocationMessage: msg.isLocationMessage,
            });

            // Also create adapter for backward compatibility with old command handlers
            const messageAdapter = {
              ...msg,
              body: messageText,
              from: chatJid,
              hasQuotedMsg:
                !!message.message?.extendedTextMessage?.contextInfo
                  ?.quotedMessage,
              // Preserve all MessageWrapper methods
              downloadMedia: () => msg.downloadMedia(),
              reply: (text, quotedMsg, mentions) =>
                msg.reply(text, quotedMsg, mentions),
              // Add method to get messages from store
              getStoredMessages: (limit) => {
                return messageStore.getContext(
                  msg.groupId || msg.userId,
                  null,
                  limit
                );
              },
              getQuotedMessage: async () => {
                const contextInfo =
                  message.message?.extendedTextMessage?.contextInfo;
                if (contextInfo?.quotedMessage) {
                  const quotedMsg = contextInfo.quotedMessage;

                  // Create a message-like object for the quoted message
                  return {
                    body:
                      quotedMsg.conversation ||
                      quotedMsg.extendedTextMessage?.text ||
                      quotedMsg.imageMessage?.caption ||
                      quotedMsg.videoMessage?.caption ||
                      "",
                    fromMe: contextInfo.participant === botId,
                    hasMedia: !!(
                      quotedMsg.imageMessage ||
                      quotedMsg.videoMessage ||
                      quotedMsg.stickerMessage
                    ),
                    downloadMedia: async () => {
                      try {
                        // Create a pseudo-message object for the quoted message
                        const quotedMsgObj = {
                          key: {
                            remoteJid: chatJid,
                            fromMe: contextInfo.participant === botId,
                            id: contextInfo.stanzaId,
                          },
                          message: quotedMsg,
                        };

                        const {
                          downloadMediaMessage,
                        } = require("@whiskeysockets/baileys");
                        const buffer = await downloadMediaMessage(
                          quotedMsgObj,
                          "buffer",
                          {}
                        );

                        let mimetype = "application/octet-stream";
                        if (quotedMsg.imageMessage) {
                          mimetype =
                            quotedMsg.imageMessage.mimetype || "image/jpeg";
                        } else if (quotedMsg.videoMessage) {
                          mimetype =
                            quotedMsg.videoMessage.mimetype || "video/mp4";
                        } else if (quotedMsg.stickerMessage) {
                          mimetype = "image/webp";
                        }

                        return {
                          buffer: buffer,
                          mimetype: mimetype,
                          filename: `quoted_media_${Date.now()}`,
                        };
                      } catch (error) {
                        console.error("Error downloading quoted media:", error);
                        return null;
                      }
                    },
                  };
                }
                return null;
              },
              getMentions: async () => {
                // Get mentioned JIDs from the message
                const mentionedJids =
                  message.message?.extendedTextMessage?.contextInfo
                    ?.mentionedJid || [];

                // Get the actual message text to extract names
                const messageText = getMessageText(message) || "";

                console.log(`📱 Processing mentions:`, {
                  jids: mentionedJids,
                  messageText: messageText.substring(0, 100),
                });

                // Convert to contact objects
                const mentions = [];

                // Extract names from message text - this is the most reliable method
                // Format: @Name or @919876543210 or @22217882616014 (LID)
                const namesInText = [];
                const atRegex = /@([^\s]+)/g;
                let match;
                while ((match = atRegex.exec(messageText)) !== null) {
                  namesInText.push(match[1]);
                }

                console.log(`📝 Names from text:`, namesInText);

                // Try to get group metadata to map LIDs to phone numbers and names
                let groupParticipants = [];
                if (isGroupChat(chatJid)) {
                  try {
                    const groupMetadata = await sock.groupMetadata(chatJid);
                    groupParticipants = groupMetadata.participants || [];
                    console.log(
                      `👥 Group has ${groupParticipants.length} participants`
                    );
                  } catch (e) {
                    console.error("Error fetching group metadata:", e.message);
                  }
                }

                for (let i = 0; i < mentionedJids.length; i++) {
                  const jid = mentionedJids[i];
                  try {
                    let displayName = null;
                    let phoneNumber = jid.split("@")[0];
                    const isLid = jid.endsWith("@lid");

                    // For LID mentions, try to find the corresponding phone number and name
                    if (isLid && groupParticipants.length > 0) {
                      // Find participant with matching LID
                      const participant = groupParticipants.find(
                        (p) => p.lid === jid
                      );
                      if (participant) {
                        // Get the phone number if available
                        if (participant.phoneNumber) {
                          phoneNumber = participant.phoneNumber.split("@")[0];
                        } else if (participant.id) {
                          phoneNumber = participant.id.split("@")[0];
                        }

                        console.log(`🔍 LID mapped to:`, {
                          lid: jid,
                          phoneNumber,
                          participantId: participant.id,
                        });

                        // Check cache using the phone number JID
                        if (
                          participant.id &&
                          contactNameCache.has(participant.id)
                        ) {
                          displayName = contactNameCache.get(participant.id);
                        }

                        // Try to fetch their status/profile to get name
                        if (!displayName && participant.id) {
                          try {
                            const profilePic = await sock
                              .profilePictureUrl(participant.id, "preview")
                              .catch(() => null);
                            // Even if we can't get pic, we tried
                            // Unfortunately Baileys doesn't have a direct way to get profile name
                            // We can only get it from messages they send
                          } catch (e) {
                            // Ignore
                          }
                        }
                      }
                    }

                    // Priority 1: Use the name from message text ONLY if it's not a number
                    // If user typed "@Name", use it. If they typed "@919876543210", skip it.
                    if (namesInText[i] && !/^\d+$/.test(namesInText[i])) {
                      displayName = namesInText[i];
                      // Cache it for future use
                      contactNameCache.set(jid, displayName);
                    }

                    // Priority 2: Check our contact name cache
                    if (!displayName && contactNameCache.has(jid)) {
                      displayName = contactNameCache.get(jid);
                    }

                    // Priority 3: Use phone number as fallback (clean format)
                    if (!displayName) {
                      // For LIDs that look like long numbers, just use last 10 digits or format nicely
                      if (isLid && phoneNumber.length > 10) {
                        // Extract last 10 digits for display
                        displayName = phoneNumber.slice(-10);
                      } else {
                        displayName = phoneNumber;
                      }
                    }

                    console.log(`✅ Mention resolved:`, {
                      jid,
                      isLid,
                      phoneNumber,
                      displayName,
                      fromCache: contactNameCache.has(jid),
                    });

                    mentions.push({
                      id: {
                        user: phoneNumber,
                        _serialized: jid,
                      },
                      pushname: displayName,
                      name: displayName,
                      number: phoneNumber,
                    });
                  } catch (error) {
                    console.error("Error processing mention:", error.message);
                    const phoneNumber = jid.split("@")[0];
                    mentions.push({
                      id: {
                        user: phoneNumber,
                        _serialized: jid,
                      },
                      pushname: phoneNumber,
                      name: phoneNumber,
                      number: phoneNumber,
                    });
                  }
                }

                return mentions;
              },
              hasMedia: !!(
                message.message?.imageMessage ||
                message.message?.videoMessage ||
                message.message?.stickerMessage
              ),
              downloadMedia: async () => {
                try {
                  const {
                    downloadMediaMessage,
                  } = require("@whiskeysockets/baileys");
                  const buffer = await downloadMediaMessage(
                    message,
                    "buffer",
                    {}
                  );

                  // Determine mimetype
                  let mimetype = "application/octet-stream";
                  if (message.message?.imageMessage) {
                    mimetype =
                      message.message.imageMessage.mimetype || "image/jpeg";
                  } else if (message.message?.videoMessage) {
                    mimetype =
                      message.message.videoMessage.mimetype || "video/mp4";
                  } else if (message.message?.stickerMessage) {
                    mimetype = "image/webp";
                  }

                  return {
                    buffer: buffer,
                    mimetype: mimetype,
                    filename: `media_${Date.now()}`,
                  };
                } catch (error) {
                  console.error("Error downloading media:", error);
                  return null;
                }
              },
              reply: async (content) => {
                const quotedMsg = {
                  key: message.key,
                  message: message.message,
                };

                if (typeof content === "string") {
                  await sock.sendMessage(
                    chatJid,
                    { text: content },
                    { quoted: quotedMsg }
                  );
                } else if (content?.image) {
                  // Handle image (like thumbnail)
                  await sock.sendMessage(
                    chatJid,
                    {
                      image: content.image,
                      caption: content.caption || "",
                    },
                    { quoted: quotedMsg }
                  );
                } else if (content?.sticker) {
                  // Handle sticker with metadata
                  await sock.sendMessage(
                    chatJid,
                    {
                      sticker: content.sticker,
                      packname: content.packname || "Fuck Off",
                      author: content.author || "Eden's Sarcasm 😈",
                    },
                    { quoted: quotedMsg }
                  );
                } else if (content?.audio) {
                  // Handle audio
                  await sock.sendMessage(
                    chatJid,
                    {
                      audio: content.audio,
                      mimetype: content.mimetype || "audio/mpeg",
                    },
                    { quoted: quotedMsg }
                  );
                } else if (content?.text && content?.media) {
                  // Handle interaction with text and media (like GIF)
                  // Only send ONE message with the media and caption
                  if (content.media.video) {
                    const videoMsg = {
                      video: content.media.video,
                      caption: content.text,
                      gifPlayback: content.media.gifPlayback !== false,
                    };

                    // Add mimetype if provided
                    if (content.media.mimetype) {
                      videoMsg.mimetype = content.media.mimetype;
                    }

                    console.log(`📤 Sending video message:`, {
                      hasVideo: !!videoMsg.video,
                      caption: videoMsg.caption?.substring(0, 30),
                      gifPlayback: videoMsg.gifPlayback,
                      mimetype: videoMsg.mimetype,
                    });

                    await sock.sendMessage(chatJid, videoMsg, {
                      quoted: quotedMsg,
                    });
                  } else if (content.media.image) {
                    await sock.sendMessage(
                      chatJid,
                      {
                        image: content.media.image,
                        caption: content.text,
                      },
                      { quoted: quotedMsg }
                    );
                  } else {
                    // For other media types, send as separate messages
                    await sock.sendMessage(
                      chatJid,
                      { text: content.text },
                      { quoted: quotedMsg }
                    );
                    await sock.sendMessage(chatJid, content.media, {
                      quoted: quotedMsg,
                    });
                  }
                } else if (content?.media) {
                  // Handle other media types
                  if (content.text) {
                    await sock.sendMessage(
                      chatJid,
                      { text: content.text },
                      { quoted: quotedMsg }
                    );
                  }
                  await sock.sendMessage(chatJid, content.media, {
                    quoted: quotedMsg,
                  });
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

            // Sometimes react to the command first
            if (Math.random() > 0.6) {
              const commandReactions = ["👀", "🙄", "😏", "💀", "🤔", "😒"];
              const randomReaction =
                commandReactions[
                  Math.floor(Math.random() * commandReactions.length)
                ];
              try {
                await sock.sendMessage(chatJid, {
                  react: {
                    text: randomReaction,
                    key: message.key,
                  },
                });
                console.log(`😊 Reacted to command with ${randomReaction}`);
              } catch (error) {
                console.error("Error reacting to command:", error);
              }
            }

            try {
              // Check if sender is a nice user
              const senderJid = message.key.participant || message.key.remoteJid;
              const niceUser = isNiceUser(senderJid);
              
              const response = await commandHandler.handleCommand(
                command,
                messageAdapter,
                {
                  senderName,
                  isOwner: owner,
                  mood: "sarcastic",
                  isNiceUser: niceUser,
                }
              );

              if (response) {
                const quotedMsg = {
                  key: message.key,
                  message: message.message,
                };

                if (typeof response === "object" && response.media) {
                  // Remove quotes from text
                  let cleanText = response.text
                    ? response.text.replace(/["""'']/g, "")
                    : "";

                  // Use mentions from response if provided, otherwise extract from text
                  let mentionJids = response.mentions || [];

                  // Send media with caption and mentions
                  const mediaMessage = {
                    ...response.media,
                  };

                  if (cleanText) {
                    mediaMessage.caption = cleanText;
                    if (mentionJids.length > 0) {
                      mediaMessage.mentions = mentionJids;
                    }
                  }

                  await sock.sendMessage(chatJid, mediaMessage, {
                    quoted: quotedMsg,
                  });
                } else {
                  // Handle string or object with text and mentions
                  let cleanResponse, mentionJids;

                  if (typeof response === "object" && response.text) {
                    // Response is an object with text and mentions
                    cleanResponse = response.text.replace(/["""'']/g, "");
                    mentionJids = response.mentions || [];
                  } else {
                    // Response is just a string
                    cleanResponse = response.replace(/["""'']/g, "");
                    mentionJids = [];
                  }

                  console.log(`📱 Sending message with mentions:`, {
                    mentionJids,
                  });

                  await sock.sendMessage(
                    chatJid,
                    {
                      text: cleanResponse,
                      mentions:
                        mentionJids.length > 0 ? mentionJids : undefined,
                    },
                    { quoted: quotedMsg }
                  );
                }
                console.log(`✅ Command response sent\n`);
              } else {
                console.log(`⚠️ Command handler returned no response\n`);
              }
            } catch (cmdError) {
              console.error("❌ Error executing command:", cmdError);
              console.error("   Command:", command);
              console.error("   Error message:", cmdError.message);

              // Send error message to user
              try {
                await sock.sendMessage(
                  chatJid,
                  {
                    text: "Ugh, something went wrong. Even I can't mess up this badly. Try again later. 🙄",
                  },
                  { quoted: { key: message.key, message: message.message } }
                );
              } catch (sendError) {
                console.error("❌ Failed to send error message:", sendError);
              }
            }
            continue;
          }

          // Check if sender is a nice user (special handling)
          const senderJid = message.key.participant || message.key.remoteJid;
          const niceUser = isNiceUser(senderJid);
          const niceUserInfo = getNiceUserInfo(senderJid);

          // Store incoming message in context with senderJid
          addMessageToContext(
            chatJid,
            senderName,
            messageText,
            false,
            null,
            senderJid
          );

          // Check if bot was mentioned or message is a reply to bot
          const mentioned = isBotMentioned(message);
          const repliedTo = isReplyToBot(message);

          console.log(
            `📬 Message check: mentioned=${mentioned}, repliedTo=${repliedTo}, text="${messageText.substring(
              0,
              50
            )}"`
          );

          if (mentioned || repliedTo) {
            // Always respond when mentioned or replied to (no probability check)

            console.log(
              `🎯 ${mentioned ? "Mention" : "Reply"} detected: ${messageText}`
            );
            console.log(
              `👤 From: ${senderName} ${isGroup ? "(Group)" : "(DM)"}`
            );

            // Sometimes react to the message first
            if (Math.random() > 0.7) {
              // Different reactions for nice users - cute and friendly
              const reactions = niceUser
                ? ["😊", "💕", "😘", "🥰", "✨", "💖"]
                : ["💀", "🙄", "😏", "💅", "👀"];
              const randomReaction =
                reactions[Math.floor(Math.random() * reactions.length)];
              try {
                await sock.sendMessage(chatJid, {
                  react: {
                    text: randomReaction,
                    key: message.key,
                  },
                });
                console.log(
                  `😊 Reacted with ${randomReaction}${
                    niceUser ? ` (nice user: ${niceUserInfo?.name})` : ""
                  }`
                );
              } catch (error) {
                console.error("Error reacting to message:", error);
              }
            }

            try {
              let response;
              let imageBase64 = null;

              // Check if message has an image
              const hasImage = message.message?.imageMessage;
              if (hasImage) {
                try {
                  console.log("📸 Detected image with mention, downloading...");
                  const {
                    downloadMediaMessage,
                  } = require("@whiskeysockets/baileys");
                  const buffer = await downloadMediaMessage(
                    message,
                    "buffer",
                    {}
                  );
                  imageBase64 = buffer.toString("base64");
                  console.log("✅ Image downloaded and converted to base64");
                } catch (imgError) {
                  console.error("Error downloading image:", imgError);
                }
              }

              if (repliedTo) {
                // Get the quoted message for context
                const quotedText =
                  message.message?.extendedTextMessage?.contextInfo
                    ?.quotedMessage?.conversation || "[Media/Sticker]";

                // Get recent conversation history with THIS specific user
                const conversationHistory = getConversationContext(
                  chatJid,
                  senderName,
                  5
                );
                const contextPrefix = conversationHistory
                  ? `Recent conversation with ${senderName}:\n${conversationHistory}\n\nNow responding to: `
                  : "";

                // Generate response based on reply
                const context = imageBase64
                  ? niceUser
                    ? `${contextPrefix}${senderName} sent pic. respond friendly and natural`
                    : `${contextPrefix}${senderName} replied to you with an image. look at it and respond like a real person. be playful and genuine, not harsh. if its personal (like selfie), be encouraging. sound natural. ${
                        isGroup
                          ? "everyones watching in the group"
                          : "just you two"
                      }. NEVER use quotation marks`
                  : niceUser
                  ? `${contextPrefix}${senderName}: ${messageText}. you said: ${quotedText}. respond like you text friends. be nice and helpful. NO swearing`
                  : owner
                  ? `${contextPrefix}${senderName} said: ${messageText}. be sarcastic. 5-10 words. examples: 'bruh what', 'lol ok', 'wtf dude'. swear sometimes`
                  : `${contextPrefix}${senderName} said: ${messageText}. ${
                      isGroup ? "group" : "dm"
                    }. sarcastic. 5-10 words. examples: 'lol ok', 'cool story', 'and?'. swear if annoyed`;

                console.log(
                  `🎭 Context mode: ${
                    niceUser ? "NICE USER (friendly)" : "REGULAR (sarcastic)"
                  } for ${senderName}`
                );
                console.log(
                  `\n📝 Context sent to LLM (reply):\n${context.substring(
                    0,
                    400
                  )}...\n`
                );

                response = await llmService.generateContextualResponse(
                  messageText || "what do you think about this image",
                  context,
                  {
                    senderName,
                    isOwner: owner,
                    mood: niceUser ? "friendly" : "sarcastic",
                  },
                  imageBase64
                );
              } else {
                // Get recent conversation history with THIS specific user
                const conversationHistory = getConversationContext(
                  chatJid,
                  senderName,
                  20
                );
                const contextPrefix = conversationHistory
                  ? `Recent conversation with ${senderName}:\n${conversationHistory}\n\nNow responding to: `
                  : "";

                // Generate response based on mention (with or without image)
                const prompt = imageBase64
                  ? messageText || "whats in this image"
                  : messageText;

                const context = imageBase64
                  ? niceUser
                    ? `${contextPrefix}${senderName} sent pic. respond friendly and natural`
                    : `${contextPrefix}${senderName} sent you an image. look at it and respond like a real person texting. be playful and witty but not mean. if someone asks how they look, be nice and encouraging with some sass. if its a selfie, compliment them genuinely. keep it natural and friendly. ${
                        isGroup ? "everyones watching" : "just you two"
                      }. NEVER use quotation marks`
                  : niceUser
                  ? `${contextPrefix}${senderName}: ${messageText}. respond friendly and helpful. NO swearing. be natural`
                  : owner
                  ? `${contextPrefix}${senderName} said: ${messageText}. sarcastic. 5-10 words max. swear if u want`
                  : `${contextPrefix}${senderName} said: ${messageText}. ${
                      isGroup ? "group" : "dm"
                    }. sarcastic. 5-10 words. swear if annoyed`;

                console.log(
                  `🎭 Context mode: ${
                    niceUser ? "NICE USER (friendly)" : "REGULAR (sarcastic)"
                  } for ${senderName}`
                );
                console.log(
                  `\n📝 Context sent to LLM (mention):\n${context.substring(
                    0,
                    400
                  )}...\n`
                );

                response = await llmService.generateContextualResponse(
                  prompt,
                  context,
                  {
                    senderName,
                    isOwner: owner,
                    mood: niceUser ? "friendly" : "sarcastic",
                  },
                  imageBase64
                );
              }

              if (response) {
                // Clean up response - remove quotes always, emojis and hashtags only for non-nice users
                response = response.replace(/["""'']/g, ""); // Remove quotes
                response = response.replace(/#\w+/g, ""); // Remove hashtags always

                // Only remove emojis for non-nice users
                if (!niceUser) {
                  response = response.replace(
                    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
                    ""
                  ); // Remove emojis
                }

                response = response.trim(); // Clean whitespace

                // Quote the original message when replying
                const sentMsg = await sock.sendMessage(
                  chatJid,
                  { text: response },
                  { quoted: message }
                );

                // Store bot's response in context with messageId
                const messageId = sentMsg?.key?.id;
                addMessageToContext(chatJid, "Eden", response, true, messageId);

                // Capture bot's LID from sent message in groups
                if (isGroup && sentMsg?.key?.participant && !botLid) {
                  botLid = sentMsg.key.participant;
                  console.log(
                    `💾 Captured bot LID from sent message: ${botLid}`
                  );
                }

                console.log(
                  `✅ Mention/Reply response sent (msgId: ${messageId})\n`
                );
              } else {
                console.log(`⚠️ LLM returned no response\n`);
              }
            } catch (llmError) {
              console.error("❌ Error generating LLM response:", llmError);
              console.error("   Message:", messageText);
              console.error("   Error message:", llmError.message);

              // Send error message to user
              try {
                await sock.sendMessage(chatJid, {
                  text: "My brain crashed. Even sarcasm has limits apparently. Try again? 🤷",
                });
              } catch (sendError) {
                console.error("❌ Failed to send error message:", sendError);
              }
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

// Clean old messages every hour
setInterval(() => {
  console.log("🧹 Cleaning old messages from database...");
  messageStore.cleanOldMessages();
  const stats = messageStore.getStats();
  console.log(
    `💾 Database stats: ${stats.totalMessages} messages in ${stats.totalChats} chats`
  );
}, 60 * 60 * 1000); // 1 hour

// Initialize the bot
console.log("🚀 Starting Eden Bot with Baileys...");
console.log(`😈 Ready to be sarcastic and respond to mentions!`);
console.log(`📝 Commands start with "${COMMAND_PREFIX}"`);
console.log(`🔔 Will respond when mentioned or replied to\n`);

connectToWhatsApp();
