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

// Contact name cache for mentions
// Maps JID -> display name from pushName or message text
const contactNameCache = new Map();

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
          console.log(`📇 Contact updated: ${displayName} (${update.id || update.lid})`);
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
                const participant = groupMetadata.participants.find(p => p.lid === senderJid);
                if (participant && participant.id) {
                  contactNameCache.set(participant.id, message.pushName);
                  console.log(`💾 Also cached for phone JID: ${participant.id}`);
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
              getMentions: async () => {
                // Get mentioned JIDs from the message
                const mentionedJids =
                  message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                
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
                    console.log(`👥 Group has ${groupParticipants.length} participants`);
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
                      const participant = groupParticipants.find(p => p.lid === jid);
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
                        if (participant.id && contactNameCache.has(participant.id)) {
                          displayName = contactNameCache.get(participant.id);
                        }
                        
                        // Try to fetch their status/profile to get name
                        if (!displayName && participant.id) {
                          try {
                            const profilePic = await sock.profilePictureUrl(participant.id, 'preview').catch(() => null);
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
                // This is a simplified version - you may need to implement full media download
                return null;
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
                    
                    await sock.sendMessage(chatJid, videoMsg, { quoted: quotedMsg });
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
                commandReactions[Math.floor(Math.random() * commandReactions.length)];
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
              const quotedMsg = {
                key: message.key,
                message: message.message,
              };

              if (typeof response === "object" && response.media) {
                if (response.text) {
                  // Remove quotes from text
                  const cleanText = response.text.replace(/["""'']/g, "");
                  await sock.sendMessage(
                    chatJid,
                    {
                      text: cleanText,
                    },
                    { quoted: quotedMsg }
                  );
                }
                await sock.sendMessage(
                  chatJid,
                  {
                    ...response.media,
                  },
                  { quoted: quotedMsg }
                );
              } else {
                // Remove quotes from response
                const cleanResponse = response.replace(/["""'']/g, "");
                await sock.sendMessage(
                  chatJid,
                  {
                    text: cleanResponse,
                  },
                  { quoted: quotedMsg }
                );
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
              // Sometimes just react with an emoji instead of responding
              if (Math.random() > 0.5) {
                const reactions = ["💀", "🙄", "😒", "💅", "🤡", "👀", "😤"];
                const randomReaction =
                  reactions[Math.floor(Math.random() * reactions.length)];
                try {
                  await sock.sendMessage(chatJid, {
                    react: {
                      text: randomReaction,
                      key: message.key,
                    },
                  });
                  console.log(`😊 Reacted with ${randomReaction}\n`);
                } catch (error) {
                  console.error("Error reacting to message:", error);
                }
              }
              continue;
            }

            console.log(
              `🎯 ${mentioned ? "Mention" : "Reply"} detected: ${messageText}`
            );
            console.log(
              `👤 From: ${senderName} ${isGroup ? "(Group)" : "(DM)"}`
            );

            // Sometimes react to the message first
            if (Math.random() > 0.7) {
              const reactions = ["💀", "🙄", "😏", "💅", "👀"];
              const randomReaction =
                reactions[Math.floor(Math.random() * reactions.length)];
              try {
                await sock.sendMessage(chatJid, {
                  react: {
                    text: randomReaction,
                    key: message.key,
                  },
                });
                console.log(`😊 Reacted with ${randomReaction}`);
              } catch (error) {
                console.error("Error reacting to message:", error);
              }
            }

            let response;

            if (repliedTo) {
              // Get the quoted message for context
              const quotedText =
                message.message?.extendedTextMessage?.contextInfo?.quotedMessage
                  ?.conversation || "[Media/Sticker]";

              // Generate response based on reply
              const context = owner
                ? `${senderName} replied to your text. hes your creator so be less harsh but still annoying. like youre rolling your eyes but lowkey care. text casually like a real person. NEVER use quotation marks or quotes around words`
                : `${senderName} replied to you saying: ${messageText}. you said before: ${quotedText}. text back sarcastic and witty. ${
                    isGroup
                      ? "everyones watching in the group"
                      : "just you two"
                  }. sound natural not robotic. be short and savage. NEVER use quotation marks or quotes`;

              response = await llmService.generateContextualResponse(
                messageText,
                context,
                { senderName, isOwner: owner, mood: "sarcastic" }
              );
            } else {
              // Generate response based on mention
              const context = owner
                ? `${senderName} mentioned you. hes your creator so dont be TOO mean but still bratty. like youre annoyed but secretly care. text naturally. NEVER use quotation marks or quotes`
                : `${senderName} mentioned you: ${messageText}. ${
                    isGroup
                      ? "everyones watching"
                      : "just you two"
                  }. text back witty sharp and dismissive. sound like a real person texting not a robot. be short and brutal. NEVER use quotation marks or quotes`;

              response = await llmService.generateContextualResponse(
                messageText,
                context,
                { senderName, isOwner: owner, mood: "sarcastic" }
              );
            }

            if (response) {
              // Remove any quotes from the response
              response = response.replace(/["""'']/g, "");
              
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
