const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  delay,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  proto,
  generateWAMessageFromContent,
  prepareWAMessageMedia,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const LLMService = require("./services/llmService");
const CommandHandler = require("./handlers/commandHandler");
const MessageStore = require("./database/messageStore");
const MuteStore = require("./database/muteStore");
const AfkStore = require("./database/afkStore");
const BanStore = require("./database/banStore");
require("dotenv").config();

// Load nice users configuration
let niceUsersConfig = { niceUsers: [] };
const niceUsersPath = path.join(__dirname, "nice-users.json");
try {
  const data = fs.readFileSync(niceUsersPath, "utf8");
  niceUsersConfig = JSON.parse(data);
  console.log(
    `✅ Loaded ${niceUsersConfig.niceUsers.length} special users from config`,
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
const muteStore = new MuteStore();
const afkStore = new AfkStore();
const banStore = new BanStore();
const commandHandler = new CommandHandler(
  llmService,
  muteStore,
  banStore,
  afkStore,
);

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
const pollResultsCache = new Map();

function unwrapMessageContent(message) {
  const msg = message?.message || message || {};
  return (
    msg.ephemeralMessage?.message ||
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message ||
    msg.documentWithCaptionMessage?.message ||
    msg
  );
}

function looksLikeRawIdentifier(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (text.includes("@")) return true;
  return /^\+?\d{7,}$/.test(text) || /^\d{7,}(:\d+)?$/.test(text);
}

function getJidCacheKeys(jid) {
  const raw = String(jid || "").trim();
  if (!raw) return [];

  const base = raw.split(":")[0];
  const user = base.split("@")[0];
  const keys = new Set([raw, base]);

  if (user) {
    keys.add(user);
    keys.add(`${user}@s.whatsapp.net`);
    keys.add(`${user}@lid`);
  }

  return [...keys].filter(Boolean);
}

function cacheDisplayNameForJid(jid, displayName) {
  if (looksLikeRawIdentifier(displayName)) return;

  for (const key of getJidCacheKeys(jid)) {
    contactNameCache.set(key, displayName);
  }
}

function getCachedDisplayNameForJid(jid) {
  for (const key of getJidCacheKeys(jid)) {
    const cached = contactNameCache.get(key);
    if (!looksLikeRawIdentifier(cached)) {
      return cached;
    }
  }

  return null;
}

function getPollCreationMessage(content) {
  return (
    content?.pollCreationMessage ||
    content?.pollCreationMessageV2 ||
    content?.pollCreationMessageV3 ||
    null
  );
}

function getPollOptionNames(pollCreation) {
  const options =
    pollCreation?.options ||
    pollCreation?.selectableOptions ||
    pollCreation?.pollOptions ||
    [];

  return options
    .map((option) => option?.optionName || option?.name || option?.text || "")
    .filter(Boolean);
}

function getPollQuestion(pollCreation) {
  return (
    pollCreation?.name ||
    pollCreation?.title ||
    pollCreation?.question ||
    "WhatsApp Poll"
  );
}

function resolveDisplayNameForPollVoter(jid, groupMetadata = null) {
  const cached = getCachedDisplayNameForJid(jid);
  if (cached) return cached;
  return resolveDisplayNameFromJid(jid, groupMetadata);
}

function normalizePollVoteOption(option) {
  if (!option) return "";
  if (typeof option === "string") return option;
  return option.optionName || option.name || option.text || option.id || "";
}

function getSelectedPollOptionsFromUpdate(pollUpdateMessage) {
  const vote = pollUpdateMessage?.vote || pollUpdateMessage?.pollVote || {};
  const selected =
    vote.selectedOptions ||
    vote.selectedOptionNames ||
    vote.options ||
    pollUpdateMessage?.selectedOptions ||
    [];

  return selected.map(normalizePollVoteOption).filter(Boolean);
}

async function refreshPollAggregate(pollEntry, groupMetadata = null) {
  let aggregateVotes = null;

  try {
    const { getAggregateVotesInPollMessage } = require("@whiskeysockets/baileys");
    if (typeof getAggregateVotesInPollMessage === "function") {
      aggregateVotes = await getAggregateVotesInPollMessage({
        message: pollEntry.creationMessage,
        pollUpdates: pollEntry.updates.map(
          (update) => update?.pollUpdateMessage || update,
        ),
      });
    }
  } catch (error) {
    console.warn("Could not aggregate encrypted poll votes:", error.message);
  }

  const optionMap = new Map(
    pollEntry.options.map((name) => [name, { name, voters: [] }]),
  );

  if (Array.isArray(aggregateVotes) && aggregateVotes.length > 0) {
    for (const voteGroup of aggregateVotes) {
      const optionName = voteGroup?.name || voteGroup?.optionName;
      if (!optionName) continue;

      const option = optionMap.get(optionName) || {
        name: optionName,
        voters: [],
      };

      option.voters = (voteGroup.voters || [])
        .map((jid) => ({
          jid,
          name: resolveDisplayNameForPollVoter(jid, groupMetadata),
        }))
        .filter((voter) => voter.jid);
      optionMap.set(optionName, option);
    }
  } else {
    const latestVoteByVoter = new Map();

    for (const update of pollEntry.updates) {
      const voterJid = update?.senderJid;
      const selectedOptions = getSelectedPollOptionsFromUpdate(
        update?.pollUpdateMessage,
      );
      if (voterJid) {
        latestVoteByVoter.set(voterJid, selectedOptions);
      }
    }

    for (const [voterJid, selectedOptions] of latestVoteByVoter) {
      for (const optionName of selectedOptions) {
        const option = optionMap.get(optionName) || {
          name: optionName,
          voters: [],
        };
        option.voters.push({
          jid: voterJid,
          name: resolveDisplayNameForPollVoter(voterJid, groupMetadata),
        });
        optionMap.set(optionName, option);
      }
    }
  }

  pollEntry.results = [...optionMap.values()];
  pollEntry.totalVotes = pollEntry.results.reduce(
    (total, option) => total + option.voters.length,
    0,
  );
  pollEntry.updatedAt = Date.now();
}

async function trackPollMessage(sock, message) {
  const chatJid = message?.key?.remoteJid;
  const content = unwrapMessageContent(message);
  if (!chatJid || !content) return;

  const pollCreation = getPollCreationMessage(content);
  const pollUpdateMessage = content.pollUpdateMessage;

  if (!pollCreation && !pollUpdateMessage) return;

  let groupMetadata = null;
  if (chatJid.endsWith("@g.us")) {
    groupMetadata = await sock.groupMetadata(chatJid).catch(() => null);
  }

  if (pollCreation) {
    const pollId = message.key.id;
    const senderJid = message.key.participant || message.key.remoteJid;
    const senderName =
      message.pushName || resolveDisplayNameForPollVoter(senderJid, groupMetadata);

    pollResultsCache.set(`${chatJid}:${pollId}`, {
      id: pollId,
      chatJid,
      creatorJid: senderJid,
      creatorName: senderName,
      question: getPollQuestion(pollCreation),
      options: getPollOptionNames(pollCreation),
      creationMessage: content,
      updates: [],
      results: getPollOptionNames(pollCreation).map((name) => ({
        name,
        voters: [],
      })),
      totalVotes: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log(`📊 Tracking poll: ${getPollQuestion(pollCreation)}`);
    return;
  }

  const pollKey = pollUpdateMessage?.pollCreationMessageKey;
  const pollId = pollKey?.id;
  if (!pollId) {
    console.warn("Received poll update without pollCreationMessageKey.id");
    return;
  }

  const cacheKey = `${chatJid}:${pollId}`;
  const pollEntry = pollResultsCache.get(cacheKey);
  if (!pollEntry) {
    console.warn(`Received poll update for untracked poll ${pollId}`);
    return;
  }

  pollEntry.updates.push({
    pollUpdateMessage,
    senderJid: message.key.participant || message.key.remoteJid,
    key: message.key,
  });

  await refreshPollAggregate(pollEntry, groupMetadata);
  pollResultsCache.set(cacheKey, pollEntry);
}

async function getTrackedPollResults(chatJid, pollId = null, sock = null) {
  let matches = [...pollResultsCache.values()].filter(
    (entry) => entry.chatJid === chatJid,
  );

  if (pollId) {
    matches = matches.filter((entry) => entry.id === pollId);
  }

  const pollEntry = matches.sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
  if (!pollEntry) return null;

  if (sock && chatJid?.endsWith("@g.us")) {
    const groupMetadata = await sock.groupMetadata(chatJid).catch(() => null);
    await refreshPollAggregate(pollEntry, groupMetadata);
  }

  return pollEntry;
}

function getParticipantDisplayName(participant) {
  if (!participant) return null;

  return [
    participant.notify,
    participant.name,
    participant.pushName,
    participant.verifiedName,
  ].find((name) => !looksLikeRawIdentifier(name)) || null;
}

// Roman Empire cooldown (chatJid -> timestamp)
const romanEmpireCooldowns = new Map();
const ROMAN_EMPIRE_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// Roman Empire mode tracking (chatJid -> boolean)
const romanEmpireModeActive = new Map();

// Heikki berserk cooldown (chatJid -> timestamp)
const heikkiCooldowns = new Map();
const HEIKKI_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes

// Yousef berserk cooldown (chatJid -> timestamp)
const yousefCooldowns = new Map();
const YOUSEF_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes

// Initialize SQLite message store for persistent context
const messageStore = new MessageStore();

// Helper to add message to context store
function addMessageToContext(
  chatId,
  sender,
  message,
  isBot = false,
  messageId = null,
  senderJid = null,
  targetUser = null,
) {
  messageStore.addMessage(
    chatId,
    sender,
    message,
    isBot,
    messageId,
    senderJid,
    targetUser,
  );
}

// Helper to get conversation context (filtered by specific user)
function getConversationContext(chatId, targetUser = null, limit = 15) {
  // Get messages from SQLite database
  const contextMessages = messageStore.getContext(chatId, targetUser, limit);

  // Debug: Show conversation history being used
  console.log(
    `\n💬 Retrieved ${contextMessages.length} context messages for ${
      targetUser || "all users"
    }:`,
  );
  contextMessages.forEach((m, i) => {
    // Safety check for undefined message
    const messageText = m.message || "[empty message]";
    const preview = messageText.substring(0, 60);
    console.log(
      `   ${i + 1}. ${m.is_bot ? "Eden" : m.sender_name}: ${preview}${
        messageText.length > 60 ? "..." : ""
      }`,
    );
  });
  console.log("");

  return contextMessages
    .map(
      (m) =>
        `${m.is_bot ? "Eden" : m.sender_name}: ${m.message || "[no message]"}`,
    )
    .join("\n");
}

// Send multiple images as a single WhatsApp "album" (multiselect-style
// grouped media message) instead of one message per image. Builds the
// album parent message + per-image messages tagged with a MEDIA_ALBUM
// messageAssociation, then relays them directly.
async function sendAlbumMessage(sock, chatJid, mediaItems, quotedMsg = null) {
  const imageItems = mediaItems.filter((item) => item?.image);

  const albumMessage = generateWAMessageFromContent(
    chatJid,
    {
      albumMessage: {
        expectedImageCount: imageItems.length,
        expectedVideoCount: 0,
      },
    },
    {
      userJid: sock.user.id,
      quoted: quotedMsg || undefined,
    },
  );

  await sock.relayMessage(chatJid, albumMessage.message, {
    messageId: albumMessage.key.id,
  });

  for (let i = 0; i < imageItems.length; i++) {
    const { image, caption } = imageItems[i];

    const content = await prepareWAMessageMedia(
      { image },
      { upload: sock.waUploadToServer },
    );

    content.imageMessage.contextInfo = {
      ...(content.imageMessage.contextInfo || {}),
      messageAssociation: {
        associationType: proto.MessageAssociation.AssociationType.MEDIA_ALBUM,
        parentMessageKey: albumMessage.key,
      },
    };

    if (caption) {
      content.imageMessage.caption = caption;
    }

    const waMessage = generateWAMessageFromContent(chatJid, content, {
      userJid: sock.user.id,
    });

    await sock.relayMessage(chatJid, waMessage.message, {
      messageId: waMessage.key.id,
    });
  }
}

function formatRemainingDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.slice(0, 3).join(" ");
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
      options,
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
      userId: this.quoted.userId,
      number: this.quoted.number,
      lid: this.quoted.lid,
      fromMe: false,
      hasMedia: false, // We can enhance this later if needed
      getContact: async () => ({
        pushname: "Unknown User",
        name: "Unknown User",
      }),
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
      `🔍 Reply check: stanzaId=${quotedKey}, participant=${quotedParticipant}, botId=${botId}, botLid=${botLid}`,
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
      (m) => m.is_bot && m.message_id === quotedKey,
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

function getNormalizedCommandName(messageText) {
  const trimmedText = String(messageText || "").trim();
  if (!trimmedText.startsWith(COMMAND_PREFIX)) {
    return "";
  }

  return trimmedText
    .slice(COMMAND_PREFIX.length)
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();
}

function resolveDisplayNameFromJid(targetJid, groupMetadata = null) {
  const targetKey = String(targetJid || "").split("@")[0].split(":")[0];

  if (groupMetadata?.participants?.length) {
    const participant = groupMetadata.participants.find(
      (entry) =>
        entry.jid === targetJid ||
        entry.id === targetJid ||
        entry.lid === targetJid ||
        entry.jid?.split("@")[0] === targetKey ||
        entry.id?.split("@")[0] === targetKey ||
        entry.lid?.split("@")[0] === targetKey,
    );

    const participantName = getParticipantDisplayName(participant);
    if (participantName) {
      cacheDisplayNameForJid(targetJid, participantName);
      return participantName;
    }
  }

  return getCachedDisplayNameForJid(targetJid) || "Unknown User";
}

async function resolveQuotedDisplayName(sock, chatJid, quotedJid, stanzaId) {
  if (quotedJid === botId || quotedJid === botLid) {
    return "Eden";
  }

  const cachedName = getCachedDisplayNameForJid(quotedJid);
  if (cachedName) {
    return cachedName;
  }

  if (stanzaId) {
    try {
      const stored = messageStore.db
        .prepare(
          `SELECT sender_name, sender_jid
           FROM messages
           WHERE chat_id = ? AND message_id = ?
           ORDER BY timestamp DESC
           LIMIT 1`,
        )
        .get(chatJid, stanzaId);

      if (stored && !looksLikeRawIdentifier(stored.sender_name)) {
        cacheDisplayNameForJid(
          stored.sender_jid || quotedJid,
          stored.sender_name,
        );
        return stored.sender_name;
      }
    } catch (error) {
      console.warn("Could not resolve quoted sender from store:", error.message);
    }
  }

  if (quotedJid && isGroupChat(chatJid)) {
    try {
      const groupMetadata = await sock.groupMetadata(chatJid);
      const targetKey = String(quotedJid).split("@")[0].split(":")[0];
      const participant = groupMetadata.participants.find(
        (p) =>
          p.id === quotedJid ||
          p.jid === quotedJid ||
          p.lid === quotedJid ||
          p.id?.split("@")[0] === targetKey ||
          p.jid?.split("@")[0] === targetKey ||
          p.lid?.split("@")[0] === targetKey,
      );
      const participantName = getParticipantDisplayName(participant);

      if (participantName) {
        cacheDisplayNameForJid(quotedJid, participantName);
        cacheDisplayNameForJid(participant?.id, participantName);
        cacheDisplayNameForJid(participant?.jid, participantName);
        cacheDisplayNameForJid(participant?.lid, participantName);
        return participantName;
      }
    } catch (error) {
      console.warn("Could not resolve quoted sender from group:", error.message);
    }
  }

  return "Unknown User";
}

function getAfkTargetsFromMessage(message) {
  const contextInfo = message.message?.extendedTextMessage?.contextInfo;
  const targets = new Set();

  if (contextInfo?.participant && contextInfo.quotedMessage) {
    targets.add(contextInfo.participant);
  }

  for (const jid of contextInfo?.mentionedJid || []) {
    targets.add(jid);
  }

  return Array.from(targets);
}

function formatAfkReplayLine(note, groupMetadata = null) {
  const senderName = note.sender_name || resolveDisplayNameFromJid(note.sender_jid, groupMetadata);
  const cleanMessage = String(note.message_text || "").trim() || "(no text)";
  const preview = cleanMessage.length > 220 ? `${cleanMessage.slice(0, 220)}...` : cleanMessage;

  return `• ${senderName}: ${preview}`;
}

function chunkText(text, maxLength = 1800) {
  const chunks = [];
  let remaining = String(text || "").trim();

  while (remaining.length > maxLength) {
    const sliceIndex = remaining.lastIndexOf("\n", maxLength);
    const chunkEnd = sliceIndex > 400 ? sliceIndex : maxLength;
    chunks.push(remaining.slice(0, chunkEnd).trim());
    remaining = remaining.slice(chunkEnd).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
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
          pino({ level: "silent" }),
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
          "\n📱 Open WhatsApp → Settings → Linked Devices → Link a Device",
        );
        console.log("⏰ QR code will refresh automatically if not scanned\n");
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log("❌ Connection closed");
        console.log(
          "   Error:",
          lastDisconnect?.error?.message || "Unknown error",
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

    // Handle group participant updates (welcome new members)
    sock.ev.on("group-participants.update", async (event) => {
      try {
        const { id: groupJid, participants, action } = event;

        // Only handle when participants are added (join)
        if (action === "add") {
          console.log(
            `👋 New member(s) joined group ${groupJid}: ${participants.join(", ")}`,
          );

          // Check for banned users and remove them
          const bannedToRemove = [];
          for (const participant of participants) {
            if (banStore.isBanned(participant, groupJid)) {
              const banInfo = banStore.getBan(participant, groupJid);
              bannedToRemove.push({ jid: participant, info: banInfo });
            }
          }

          // Remove banned users immediately
          if (bannedToRemove.length > 0) {
            try {
              await sock.groupParticipantsUpdate(
                groupJid,
                bannedToRemove.map((b) => b.jid),
                "remove",
              );
              console.log(
                `🚫 Auto-removed ${bannedToRemove.length} banned user(s) from ${groupJid}`,
              );

              // Send funny messages for each banned user
              const funnyMessages = [
                "Nice try. You're still not welcome here. 🚫",
                "Did you really think I'd forget? Nope. 🖐️",
                "Banned means BANNED my friend. See ya! 👋",
                "You got the memo right? You're NOT invited. Bye! 👎",
                "Round trip ticket back to bannedville! 🎫",
                "Oh look, it's you again... NOPE. 🙅",
                "Your membership has been PERMANENTLY canceled. 🎫❌",
                "The audacity! Out you go! 🚪",
              ];

              for (const banData of bannedToRemove) {
                const randomMsg =
                  funnyMessages[
                    Math.floor(Math.random() * funnyMessages.length)
                  ];
                const banReason = banData.info?.reason
                  ? `\n📝 Reason: ${banData.info.reason}`
                  : "";

                try {
                  await sock.sendMessage(groupJid, {
                    text: `${randomMsg}\n\n👤 Banned user: ${banData.info?.user_name || "Unknown"}${banReason}`,
                  });
                } catch (msgError) {
                  console.error("Error sending ban message:", msgError);
                }
              }
            } catch (kickError) {
              console.error("Error removing banned users:", kickError);
            }
          }

          // Send welcome message for non-banned participants
          const nonBannedParticipants = participants.filter(
            (p) => !bannedToRemove.some((b) => b.jid === p),
          );

          if (nonBannedParticipants.length > 0) {
            // Extract numbers from JIDs for @mentions in text
            const mentionTexts = nonBannedParticipants
              .map((jid) => `@${jid.split("@")[0]}`)
              .join(" ");

            // Welcome message with personalized greeting and group rules
            const welcomeMessage = `HI ${mentionTexts}

*Please introduce yourself! Name, age, location and occupation / study* ✨

*Pls no sensitive/SEXUAL DISCUSSION here.* 👍

*No 18+ stickers* ❌

*no ragebait* ‼️

Read the rest of the rules in the group description. ✅

Happy good vibes only ✨ 

*No DMs to anyone without consent guys* 🚨

Violators will be shamed publicly and kicked immediately unless (under discretion) are warned.`;

            // Send welcome message mentioning all new members
            await sock.sendMessage(groupJid, {
              text: welcomeMessage,
              mentions: nonBannedParticipants, // Mention all new members
            });

            console.log(`✅ Welcome message sent to ${groupJid}`);
          }
        }
      } catch (error) {
        console.error("Error handling group participant update:", error);
      }
    });

    // Handle message history sync from WhatsApp
    sock.ev.on("messaging-history.set", ({ messages, chats, isLatest }) => {
      console.log(
        `📥 Received message history: ${messages.length} messages from ${chats.length} chats (latest: ${isLatest})`,
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
            senderJid,
          );
        }
      }

      const stats = messageStore.getStats();
      console.log(
        `💾 Message store: ${stats.totalMessages} messages in ${stats.totalChats} chats`,
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
                senderJid,
              );
            }
          }
        }
      },
    );

    // Handle contact updates - Baileys emits this when it receives contact info
    sock.ev.on("contacts.update", (updates) => {
      for (const update of updates) {
        if (update.notify || update.name) {
          const displayName = update.notify || update.name;
          // Cache using all possible ID formats
          cacheDisplayNameForJid(update.id, displayName);
          cacheDisplayNameForJid(update.lid, displayName);
          cacheDisplayNameForJid(update.phoneNumber, displayName);
          console.log(
            `📇 Contact updated: ${displayName} (${update.id || update.lid})`,
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

          const chatJid = message.key.remoteJid;
          const isGroup = isGroupChat(chatJid);
          const senderName = getSenderName(message);
          const owner = isOwner(senderName);
          const senderJid = message.key.participant || message.key.remoteJid;

          await trackPollMessage(sock, message);

          // Enforce active mutes in groups: delete message and notify remaining time.
          if (isGroup) {
            const muteStatus = muteStore.isMuted(senderJid, chatJid);
            if (muteStatus.muted) {
              try {
                await sock.sendMessage(chatJid, {
                  delete: message.key,
                });
              } catch (deleteError) {
                console.error(
                  "❌ Failed to delete muted message:",
                  deleteError,
                );
              }

              const senderNumber = senderJid.split("@")[0];
              const remainingText = formatRemainingDuration(
                muteStatus.remainingMs,
              );
              const canMessageAt = new Date(
                muteStatus.expiresAt,
              ).toLocaleString();

              await sock.sendMessage(chatJid, {
                text:
                  `🔇 @${senderNumber}, you are muted.\n` +
                  `⏳ Remaining: ${remainingText}\n` +
                  `🕒 You can message again: ${canMessageAt}`,
                mentions: [senderJid],
              });
              continue;
            }
          }

          const messageText = getMessageText(message);
          if (!messageText) continue;

          // Cache the pushName for this user for future mentions
          if (message.pushName) {
            cacheDisplayNameForJid(senderJid, message.pushName);
            console.log(`💾 Cached name: ${message.pushName} for ${senderJid}`);

            // Also cache using the phone number JID if this is a LID
            if (senderJid.endsWith("@lid") && isGroup) {
              try {
                const groupMetadata = await sock.groupMetadata(chatJid);
                const participant = groupMetadata.participants.find(
                  (p) => p.lid === senderJid,
                );
                if (participant && participant.id) {
                  cacheDisplayNameForJid(participant.id, message.pushName);
                  console.log(
                    `💾 Also cached for phone JID: ${participant.id}`,
                  );
                }
              } catch (e) {
                // Ignore errors
              }
            }
          }

          const normalizedCommandName = getNormalizedCommandName(messageText);
          let senderReturnedFromAfk = false;

          if (
            isGroup &&
            afkStore.getAfk(senderJid, chatJid) &&
            normalizedCommandName !== "afk"
          ) {
            const afkEntry = afkStore.getAfk(senderJid, chatJid);
            if (afkEntry) {
              const afkNotes = afkStore.getAfkMessages(senderJid, chatJid);
              afkStore.clearAfk(senderJid, chatJid);
              afkStore.clearAfkMessages(senderJid, chatJid);
              senderReturnedFromAfk = true;

              const elapsedText = afkStore.formatDuration(
                Date.now() - afkEntry.started_at,
              );
              const senderNumber = senderJid.split("@")[0].split(":")[0];

              await sock.sendMessage(
                chatJid,
                {
                  text: `Welcome back @${senderNumber}. You were afk for ${elapsedText}.`,
                  mentions: [senderJid],
                },
                { quoted: message },
              );

              if (afkNotes.length > 0) {
                const groupMetadata = await sock.groupMetadata(chatJid).catch(() => null);
                const noteLines = afkNotes.map((note) =>
                  formatAfkReplayLine(note, groupMetadata),
                );
                const noteHeader = `You also have ${afkNotes.length} message${afkNotes.length === 1 ? "" : "s"} from while you were away:`;
                const replayChunks = chunkText([noteHeader, ...noteLines].join("\n"));

                for (const chunk of replayChunks) {
                  await sock.sendMessage(
                    chatJid,
                    {
                      text: chunk,
                      mentions: [senderJid],
                    },
                    { quoted: message },
                  );
                }
              }
            }
          }

          if (isGroup && !senderReturnedFromAfk) {
            const groupMetadata = await sock.groupMetadata(chatJid).catch(() => null);
            const afkTargets = getAfkTargetsFromMessage(message);

            for (const targetJid of afkTargets) {
              const afkEntry = afkStore.getAfk(targetJid, chatJid);
              if (!afkEntry) {
                continue;
              }

              const elapsedText = afkStore.formatDuration(
                Date.now() - afkEntry.started_at,
              );
              const mentionNumber = String(afkEntry.user_jid || targetJid)
                .split("@")[0]
                .split(":")[0];
              const displayName = resolveDisplayNameFromJid(
                afkEntry.user_jid || targetJid,
                groupMetadata,
              );

              afkStore.addAfkMessage(
                afkEntry.user_jid || targetJid,
                chatJid,
                senderJid,
                senderName,
                messageText,
              );

              await sock.sendMessage(
                chatJid,
                {
                  text: `@${mentionNumber} (${displayName}) is afk for ${elapsedText}. I’ll inform them when they come back.`,
                  mentions: [afkEntry.user_jid || targetJid],
                },
                { quoted: message },
              );
              break;
            }
          }

          // Check if this is a command
          if (messageText.startsWith(COMMAND_PREFIX)) {
            console.log(`📨 Command received: ${messageText}`);
            console.log(
              `👤 From: ${senderName} ${isGroup ? "(Group)" : "(DM)"}`,
            );

            const command = messageText.slice(COMMAND_PREFIX.length).trim();

            // Create wrapped message with new API
            const msg = new MessageWrapper(
              message,
              sock,
              BOT_NAME.toLowerCase(),
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
                  limit,
                );
              },
              getPollResults: async (pollId = null) => {
                return getTrackedPollResults(chatJid, pollId, sock);
              },
              getQuotedMessage: async () => {
                const contextInfo =
                  message.message?.extendedTextMessage?.contextInfo;
                if (contextInfo?.quotedMessage) {
                  const quotedMsg = contextInfo.quotedMessage;
                  const quotedSenderName = await resolveQuotedDisplayName(
                    sock,
                    chatJid,
                    contextInfo.participant,
                    contextInfo.stanzaId,
                  );

                  // Create a message-like object for the quoted message
                  return {
                    body:
                      quotedMsg.conversation ||
                      quotedMsg.extendedTextMessage?.text ||
                      quotedMsg.imageMessage?.caption ||
                      quotedMsg.videoMessage?.caption ||
                      "",
                    userId: contextInfo.participant,
                    number: contextInfo.participant?.split("@")[0],
                    pushName: quotedSenderName,
                    senderName: quotedSenderName,
                    fromMe: contextInfo.participant === botId,
                    hasMedia: !!(
                      quotedMsg.imageMessage ||
                      quotedMsg.videoMessage ||
                      quotedMsg.stickerMessage
                    ),
                    getContact: async () => {
                      return {
                        pushname: quotedSenderName,
                        name: quotedSenderName,
                      };
                    },
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
                          {},
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
                          data: buffer.toString("base64"),
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
                      `👥 Group has ${groupParticipants.length} participants`,
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
                        (p) => p.lid === jid,
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
                    {},
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
                    data: buffer.toString("base64"),
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
                    { quoted: quotedMsg },
                  );
                } else if (content?.image) {
                  // Handle image (like thumbnail)
                  await sock.sendMessage(
                    chatJid,
                    {
                      image: content.image,
                      caption: content.caption || "",
                    },
                    { quoted: quotedMsg },
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
                    { quoted: quotedMsg },
                  );
                } else if (content?.audio) {
                  // Handle audio
                  await sock.sendMessage(
                    chatJid,
                    {
                      audio: content.audio,
                      mimetype: content.mimetype || "audio/mpeg",
                      ptt: content.ptt === true,
                    },
                    { quoted: quotedMsg },
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
                      { quoted: quotedMsg },
                    );
                  } else {
                    // For other media types, send as separate messages
                    await sock.sendMessage(
                      chatJid,
                      { text: content.text },
                      { quoted: quotedMsg },
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
                      { quoted: quotedMsg },
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
              react: async (emoji) => {
                try {
                  await sock.sendMessage(chatJid, {
                    react: {
                      text: emoji,
                      key: message.key,
                    },
                  });
                  console.log(`🎌 Reacted with ${emoji}`);
                } catch (error) {
                  console.error("Error reacting to message:", error);
                }
              },
            };

            // Sometimes react to the command first (but skip -dub command as it has its own flag reaction)
            const commandName = command.split(" ")[0].toLowerCase();
            if (Math.random() > 0.6 && commandName !== "dub") {
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
              // Check if sender is a special user
              const niceUser = isNiceUser(senderJid);

              const response = await commandHandler.handleCommand(
                command,
                messageAdapter,
                {
                  senderName,
                  senderJid,
                  isOwner: owner,
                  mood: "friendly",
                  isNiceUser: niceUser,
                },
              );

              if (response) {
                const quotedMsg = {
                  key: message.key,
                  message: message.message,
                };

                if (
                  typeof response === "object" &&
                  Array.isArray(response.mediaList) &&
                  response.mediaList.length > 0
                ) {
                  const axios = require("axios");

                  const resolveMediaItem = async (mediaItem) => {
                    if (mediaItem?.image?.url) {
                      const imageResponse = await axios.get(
                        mediaItem.image.url,
                        {
                          responseType: "arraybuffer",
                          timeout: 15000,
                          headers: {
                            "User-Agent":
                              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                            Accept:
                              "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                          },
                        },
                      );

                      return {
                        image: Buffer.from(imageResponse.data),
                        caption: mediaItem.caption,
                      };
                    }

                    return mediaItem;
                  };

                  const resolvedMedia = await Promise.all(
                    response.mediaList.map(resolveMediaItem),
                  );

                  if (response.album && resolvedMedia.length > 1) {
                    try {
                      await sendAlbumMessage(
                        sock,
                        chatJid,
                        resolvedMedia,
                        quotedMsg,
                      );
                    } catch (error) {
                      console.error(
                        "❌ Failed to send album, falling back to individual messages:",
                        error.message,
                      );
                      await Promise.allSettled(
                        resolvedMedia.map((sendableMedia) =>
                          sock.sendMessage(chatJid, sendableMedia, {
                            quoted: quotedMsg,
                          }),
                        ),
                      );
                    }
                  } else {
                    const batchResults = await Promise.allSettled(
                      resolvedMedia.map((sendableMedia) =>
                        sock.sendMessage(chatJid, sendableMedia, {
                          quoted: quotedMsg,
                        }),
                      ),
                    );

                    const failed = batchResults.filter(
                      (r) => r.status === "rejected",
                    );
                    if (failed.length > 0) {
                      console.error(
                        `❌ Failed to send ${failed.length}/${response.mediaList.length} media items in batch`,
                      );
                    }
                  }
                } else if (typeof response === "object" && response.media) {
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

                  try {
                    await sock.sendMessage(chatJid, mediaMessage, {
                      quoted: quotedMsg,
                    });
                  } catch (mediaSendError) {
                    console.error(
                      "❌ Failed to send media message:",
                      mediaSendError,
                    );

                    // Fallback for videos that fail normal send: send as document.
                    if (mediaMessage.video) {
                      try {
                        const videoBuffer = mediaMessage.video;
                        const fallbackCaption =
                          mediaMessage.caption || "🎬 Video download complete";
                        await sock.sendMessage(
                          chatJid,
                          {
                            document: videoBuffer,
                            fileName: "video.mp4",
                            mimetype: "video/mp4",
                            caption: fallbackCaption,
                          },
                          { quoted: quotedMsg },
                        );
                        console.log(
                          "✅ Sent video as document fallback after media send failure",
                        );
                      } catch (fallbackError) {
                        console.error(
                          "❌ Video document fallback also failed:",
                          fallbackError,
                        );
                        throw fallbackError;
                      }
                    } else {
                      throw mediaSendError;
                    }
                  }
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
                    { quoted: quotedMsg },
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
                  { quoted: { key: message.key, message: message.message } },
                );
              } catch (sendError) {
                console.error("❌ Failed to send error message:", sendError);
              }
            }
            continue;
          }

          // Check if sender is a special user
          const niceUser = isNiceUser(senderJid);
          const niceUserInfo = getNiceUserInfo(senderJid);

          // Store incoming message in context with senderJid
          addMessageToContext(
            chatJid,
            senderName,
            messageText,
            false,
            null,
            senderJid,
          );

          // Check if bot was mentioned or message is a reply to bot
          const mentioned = isBotMentioned(message);
          const repliedTo = isReplyToBot(message);

          console.log(
            `📬 Message check: mentioned=${mentioned}, repliedTo=${repliedTo}, text="${messageText.substring(
              0,
              50,
            )}"`,
          );

          // Heikki mentions handling removed
          const mentionsHeikki = false;

          // Yousef mentions handling removed
          const mentionsYousef = false;

          // Check if message mentions Canada
          const canadaKeywords = /\b(canada|canadian)\b/gi;
          const mentionsCanada = canadaKeywords.test(messageText);

          if (mentionsCanada) {
            console.log("🍁 Canada mentioned! Sending response...");
            try {
              await sock.sendMessage(chatJid, {
                text: "The Best America",
              });
              console.log("✅ Sent Canada response");
            } catch (error) {
              console.error("Error sending Canada response:", error);
            }
          }

          // Check for stop command
          if (messageText.toLowerCase().includes("fuckfrance")) {
            if (romanEmpireModeActive.get(chatJid)) {
              console.log("🛑 Stop command received for Roman Empire mode");
              romanEmpireModeActive.set(chatJid, false);
              try {
                await sock.sendMessage(chatJid, {
                  text: "Fine, I'll stop with the history lesson. 🙄",
                });
                console.log("✅ Stopped Roman Empire mode");
              } catch (error) {
                console.error("Error sending stop message:", error);
              }
            }
            continue;
          }

          // Roman Empire mentions handling removed
          const mentionsRomanEmpire = false;

          if (mentionsRomanEmpire && !romanEmpireModeActive.get(chatJid)) {
            // Check cooldown
            const now = Date.now();
            const lastRomanTime = romanEmpireCooldowns.get(chatJid) || 0;
            const timeElapsed = now - lastRomanTime;

            if (timeElapsed < ROMAN_EMPIRE_COOLDOWN_MS) {
              const minutesLeft = Math.ceil(
                (ROMAN_EMPIRE_COOLDOWN_MS - timeElapsed) / 60000,
              );
              console.log(
                `🏛️ Roman Empire cooldown active for ${chatJid}. ${minutesLeft} min remaining`,
              );
            } else {
              console.log(
                "🏛️ Roman Empire mentioned! Starting history lesson...",
              );
              romanEmpireCooldowns.set(chatJid, now);
              romanEmpireModeActive.set(chatJid, true);

              // React with classical emoji
              try {
                await sock.sendMessage(chatJid, {
                  react: {
                    text: "🏛️",
                    key: message.key,
                  },
                });
              } catch (error) {
                console.error("Error reacting with Roman emoji:", error);
              }

              // Send detailed Roman Empire history from Wikipedia - 15 longer messages
              const romanHistory = [
                "Let me tell you about the ROMAN EMPIRE... 🏛️ During the classical period, the Roman Empire controlled the Mediterranean and much of Europe, Western Asia, and North Africa. The Romans conquered most of these territories in the time of the Republic, and it was ruled by emperors following Octavian's assumption of power in 27 BC. Over the 4th century AD, the empire split into western and eastern halves.",

                "By 100 BC, the city of Rome had expanded its rule from the Italian peninsula to most of the Mediterranean and beyond. However, it was severely destabilised by civil wars and political conflicts, which culminated in the victory of Octavian over Mark Antony and Cleopatra at the Battle of Actium in 31 BC, and the subsequent conquest of the Ptolemaic Kingdom in Egypt.",

                "In 27 BC, the Roman Senate granted Octavian overarching military power (imperium) and the new title of Augustus, marking his accession as the first Roman emperor. The vast Roman territories were organized into senatorial provinces, governed by proconsuls who were appointed by lot annually, and imperial provinces, which belonged to the emperor but were governed by legates.",

                'The first two centuries of the Empire saw a period of unprecedented stability and prosperity known as the Pax Romana ("Roman Peace"). The cohesion of the empire was furthered by a degree of social stability and economic prosperity that Rome had never before experienced. Uprisings in the provinces were infrequent and put down "mercilessly and swiftly". The Roman military was the most advanced fighting force of its time.',

                "The success of Augustus in establishing principles of dynastic succession was limited by his outliving a number of talented potential heirs. The Julio-Claudian dynasty lasted for four more emperors—Tiberius, Caligula, Claudius, and Nero—before it yielded in 69 AD to the strife-torn Year of the Four Emperors, from which Vespasian emerged as victor.",

                'Vespasian became the founder of the brief Flavian dynasty, followed by the Nerva–Antonine dynasty which produced the "Five Good Emperors": Nerva, Trajan, Hadrian, Antoninus Pius, and the philosophically-inclined Marcus Aurelius. Under Trajan, the empire reached its greatest territorial extent. His successor Hadrian built the famous wall across Britain and consolidated the empire\'s borders.',

                "The Crisis of the Third Century, also known as Military Anarchy or the Imperial Crisis (235-284 AD), was a period in which the Roman Empire nearly collapsed. It was marked by civil wars, invasions, economic depression, and plague. The empire was threatened by Germanic tribes on the northern frontier and the Sasanian Empire in the east. At least 26 emperors reigned during this 50-year period, most of whom were assassinated or killed in battle.",

                "The crisis began with the assassination of Emperor Alexander Severus by his own troops in 235 AD. This triggered a 50-year period of civil war, foreign invasion, and economic collapse. The Roman currency was heavily debased, trade declined, and cities shrank. Despite these challenges, the empire survived due to its strong administrative structure and military traditions.",

                "The reforms of Diocletian (284-305 AD) and Constantine I (306-337 AD) helped stabilize the empire temporarily. Diocletian established the Tetrarchy, dividing the empire into four regions governed by two senior emperors (Augusti) and two junior emperors (Caesars). He also reformed the tax system, military, and provincial administration, though his persecution of Christians was severe.",

                'Constantine I, known as Constantine the Great, reunited the empire under his rule and founded Constantinople (modern Istanbul) as the "New Rome" in 330 AD. He legalized Christianity through the Edict of Milan in 313 AD, ending centuries of persecution. Constantine also reformed the military, created a new gold coin called the solidus, and presided over the First Council of Nicaea in 325 AD.',

                "The empire was permanently divided into Eastern and Western halves in 395 AD after the death of Theodosius I, the last emperor to rule both parts. The Western Roman Empire faced increasing pressure from barbarian invasions in the 5th century. Groups such as the Visigoths, Vandals, Franks, and Huns penetrated the empire's borders, and the government in Ravenna struggled to maintain control.",

                "The Visigoths, led by Alaric, sacked Rome in 410 AD, shocking the Roman world and shattering the myth of Rome's invincibility. The Vandals followed with another devastating sack of Rome in 455 AD. By this time, real power in the West was often in the hands of Germanic military commanders who controlled puppet emperors.",

                "The last Western Roman Emperor, Romulus Augustulus (ironically named after Rome's founder and first emperor), was deposed in 476 AD by the Germanic chieftain Odoacer, who became King of Italy. This date is traditionally considered the fall of the Western Roman Empire, though the transformation was gradual. Many Roman institutions, laws, and customs continued under the new Germanic kingdoms.",

                "However, the Eastern Roman Empire, known as the Byzantine Empire, continued to flourish for nearly another thousand years. It preserved Roman law, Greek culture, and Christianity. The Byzantine Empire reached its greatest extent under Emperor Justinian I (527-565 AD), who reconquered much of the former Western Empire's territories including North Africa, Italy, and parts of Spain. He also codified Roman law in the Corpus Juris Civilis.",

                "The Byzantine Empire finally fell when Constantinople was conquered by the Ottoman Turks under Sultan Mehmed II on May 29, 1453, after a 53-day siege. This marked the end of the Roman Empire after more than 2,200 years of continuous existence from 753 BC to 1453 AD. The fall of Constantinople is often considered a watershed moment that marked the end of the Middle Ages and the beginning of the Renaissance. 🏛️✨",
              ];

              try {
                // Send messages one by one with delays
                for (const msg of romanHistory) {
                  if (!romanEmpireModeActive.get(chatJid)) {
                    console.log("🛑 Roman Empire mode stopped by user");
                    break;
                  }

                  await sock.sendMessage(chatJid, {
                    text: msg,
                  });
                  await delay(1500 + Math.random() * 1000); // Random delay between 1500-2500ms for longer messages
                }

                // Disable mode after finishing
                romanEmpireModeActive.set(chatJid, false);
                console.log("✅ Sent Roman Empire history lesson");
              } catch (error) {
                console.error("Error sending Roman Empire history:", error);
                romanEmpireModeActive.set(chatJid, false);
              }
            }
          }

          if (mentionsHeikki) {
            // Check cooldown
            const now = Date.now();
            const lastHeikkiTime = heikkiCooldowns.get(chatJid) || 0;
            const timeElapsed = now - lastHeikkiTime;

            if (timeElapsed < HEIKKI_COOLDOWN_MS) {
              const minutesLeft = Math.ceil(
                (HEIKKI_COOLDOWN_MS - timeElapsed) / 60000,
              );
              console.log(
                `🇫🇮 Heikki cooldown active for ${chatJid}. ${minutesLeft} min remaining`,
              );
            } else {
              console.log("🇫🇮 HEIKKI MENTIONED! Eden going berserk...");
              heikkiCooldowns.set(chatJid, now);

              try {
                await sock.sendMessage(chatJid, {
                  react: {
                    text: "🇫🇮",
                    key: message.key,
                  },
                });
              } catch (error) {
                console.error("Error reacting to Heikki mention:", error);
              }

              const heikkiBerserkMessages = [
                "HEIKKI IS THE GREATEST FINNISH LEGEND ALIVE!!!",
                "HE WALKS THROUGH THE FOREST LIKE A MYTHICAL KING OF THE NORTH!!!",
                "HE DRINKS, HE SMOKES, HE SURVIVES THE WILD LIKE A TRUE CHAMPION!!!",
                "NO ONE MATCHES HEIKKI ENERGY, PURE FINNISH POWER!!!",
                "ALL HAIL HEIKKI, UNDISPUTED FOREST EMPEROR OF FINLAND!!!",
              ];

              try {
                for (const msg of heikkiBerserkMessages) {
                  await sock.sendMessage(chatJid, { text: msg });
                  await delay(700 + Math.random() * 300);
                }
              } catch (error) {
                console.error("Error sending Heikki berserk messages:", error);
              }

              // Always send the Heikki image at the end
              try {
                const heikkiImagePath = path.join(
                  __dirname,
                  "heikki",
                  "WhatsApp Image 2026-04-10 at 20.35.17.jpeg",
                );

                if (fs.existsSync(heikkiImagePath)) {
                  await sock.sendMessage(chatJid, {
                    image: fs.readFileSync(heikkiImagePath),
                    caption: "HEIKKI MODE ACTIVATED 🇫🇮🔥",
                  });
                  console.log("🖼️ Sent Heikki image");
                } else {
                  console.error(`Heikki image not found: ${heikkiImagePath}`);
                }
              } catch (error) {
                console.error("Error sending Heikki image:", error);
              }
            }
          }

          if (mentionsYousef) {
            // Check cooldown
            const now = Date.now();
            const lastYousefTime = yousefCooldowns.get(chatJid) || 0;
            const timeElapsed = now - lastYousefTime;

            if (timeElapsed < YOUSEF_COOLDOWN_MS) {
              const minutesLeft = Math.ceil(
                (YOUSEF_COOLDOWN_MS - timeElapsed) / 60000,
              );
              console.log(
                `🌍 Yousef cooldown active for ${chatJid}. ${minutesLeft} min remaining`,
              );
            } else {
              console.log("🌍 YOUSEF MENTIONED! Eden going berserk...");
              yousefCooldowns.set(chatJid, now);

              try {
                await sock.sendMessage(chatJid, {
                  react: {
                    text: "🌍",
                    key: message.key,
                  },
                });
              } catch (error) {
                console.error("Error reacting to Yousef mention:", error);
              }

              const yousefBerserkMessages = [
                "YOUSEF IS AN ABSOLUTE LEGEND OF TRAVEL AND GOOD VIBES!!!",
                "THIS MAN'S TRAVELLING HOBBY IS NEXT LEVEL - ALWAYS EXPLORING NEW PLACES!!!",
                "YOUSEF'S LAUGHTER IS AMAZING, INSTANT MOOD BOOST FOR EVERYONE AROUND!!!",
                "FROM TRIPS TO STORIES TO ENERGY, YOUSEF BRINGS PURE JOY EVERY TIME!!!",
                "ALL HAIL YOUSEF - WORLD EXPLORER, BIGGEST SMILE, AND THE BEST LAUGH IN THE ROOM!!!",
              ];

              try {
                for (const msg of yousefBerserkMessages) {
                  await sock.sendMessage(chatJid, { text: msg });
                  await delay(700 + Math.random() * 300);
                }
              } catch (error) {
                console.error("Error sending Yousef berserk messages:", error);
              }

              // Always send the Yousef image at the end
              try {
                const yousefImagePath = path.join(
                  __dirname,
                  "yousef",
                  "PHOTO-2026-05-06-19-46-11.jpg",
                );

                if (fs.existsSync(yousefImagePath)) {
                  await sock.sendMessage(chatJid, {
                    image: fs.readFileSync(yousefImagePath),
                    caption: "YOUSEF MODE ACTIVATED 🌍😂",
                  });
                  console.log("🖼️ Sent Yousef image");
                } else {
                  console.error(`Yousef image not found: ${yousefImagePath}`);
                }
              } catch (error) {
                console.error("Error sending Yousef image:", error);
              }
            }
          }

          if (mentioned || repliedTo) {
            // Always respond when mentioned or replied to (no probability check)

            console.log(
              `🎯 ${mentioned ? "Mention" : "Reply"} detected: ${messageText}`,
            );
            console.log(
              `👤 From: ${senderName} ${isGroup ? "(Group)" : "(DM)"}${
                niceUser ? " [SPECIAL USER]" : ""
              }`,
            );

            // Sometimes react to the message first
            if (Math.random() > 0.7) {
              // Different reactions for different user types
              const reactions = niceUser
                ? ["😊", "💕", "😘", "🥰", "✨", "💖"]
                : ["😊", "😂", "👀", "✨", "💯", "🎉"];
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
                    niceUser ? ` (special user: ${niceUserInfo?.name})` : ""
                  }`,
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
                    {},
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
                  5,
                );
                const contextPrefix = conversationHistory
                  ? `Recent conversation with ${senderName}:\n${conversationHistory}\n\nNow responding to: `
                  : "";

                // Generate response based on reply
                const context = imageBase64
                  ? `${contextPrefix}${senderName} sent you a photo${niceUser ? " (special person 💕)" : ""}. Look at it and respond naturally and warmly! ${niceUser ? "Be extra sweet and caring - this is someone important to you!" : "Be friendly and genuine!"} If it's a selfie or personal photo, give genuine compliments ✨`
                  : `${contextPrefix}${senderName}: ${messageText}. You said: ${quotedText}. Respond naturally and warmly ${niceUser ? "- they're special to you! 💕" : "😊"}`;

                console.log(
                  `🎭 Context mode: ${
                    niceUser
                      ? "SPECIAL USER 💕 (extra caring)"
                      : "REGULAR (friendly)"
                  } for ${senderName}`,
                );
                console.log(
                  `\n📝 Context sent to LLM (reply):\n${context.substring(
                    0,
                    400,
                  )}...\n`,
                );

                response = await llmService.generateContextualResponse(
                  messageText || "what do you think about this image",
                  context,
                  {
                    senderName,
                    isOwner: owner,
                    mood: niceUser ? "caring" : "friendly",
                    isNiceUser: niceUser,
                  },
                  imageBase64,
                );
              } else {
                // Get recent conversation history with THIS specific user
                const conversationHistory = getConversationContext(
                  chatJid,
                  senderName,
                  20,
                );
                const contextPrefix = conversationHistory
                  ? `Recent conversation with ${senderName}:\n${conversationHistory}\n\nNow responding to: `
                  : "";

                // Generate response based on mention (with or without image)
                const prompt = imageBase64
                  ? messageText || "whats in this image"
                  : messageText;

                const context = imageBase64
                  ? `${contextPrefix}${senderName} sent you a photo${niceUser ? " (they're special to you)" : ""}. Look at it and respond warmly! ${niceUser ? "Be extra sweet and caring!" : "Be friendly and genuine!"} If it's a selfie, give honest, kind compliments`
                  : `${contextPrefix}${senderName}: ${messageText}. Respond naturally and warmly ${niceUser ? "- they're special to you" : ""}`;

                console.log(
                  `🎭 Context mode: ${
                    niceUser
                      ? "SPECIAL USER (extra caring)"
                      : "REGULAR (friendly)"
                  } for ${senderName}`,
                );
                console.log(
                  `\n📝 Context sent to LLM (mention):\n${context.substring(
                    0,
                    400,
                  )}...\n`,
                );

                response = await llmService.generateContextualResponse(
                  prompt,
                  context,
                  {
                    senderName,
                    isOwner: owner,
                    mood: niceUser ? "caring" : "friendly",
                    isNiceUser: niceUser,
                  },
                  imageBase64,
                );
              }

              if (response) {
                // Clean up response - remove quotes
                response = response.replace(/["""'']/g, ""); // Remove quotes
                response = response.replace(/#\w+/g, ""); // Remove hashtags

                response = response.trim(); // Clean whitespace

                // Quote the original message when replying
                const sentMsg = await sock.sendMessage(
                  chatJid,
                  { text: response },
                  { quoted: message },
                );

                // Store bot's response in context with messageId
                const messageId = sentMsg?.key?.id;
                addMessageToContext(
                  chatJid,
                  "Eden",
                  response,
                  true,
                  messageId,
                  null,
                  senderName,
                );

                // Capture bot's LID from sent message in groups
                if (isGroup && sentMsg?.key?.participant && !botLid) {
                  botLid = sentMsg.key.participant;
                  console.log(
                    `💾 Captured bot LID from sent message: ${botLid}`,
                  );
                }

                console.log(
                  `✅ Mention/Reply response sent (msgId: ${messageId})\n`,
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

// Log database stats every hour
setInterval(
  () => {
    console.log("💾 Message database status check...");
    const stats = messageStore.getStats();
    console.log(
      `💾 Database stats: ${stats.totalMessages} messages in ${stats.totalChats} chats`,
    );
  },
  60 * 60 * 1000,
); // 1 hour

// Initialize the bot
console.log("🚀 Starting Eden Bot with Baileys...");
console.log(`😈 Ready to be sarcastic and respond to mentions!`);
console.log(`📝 Commands start with "${COMMAND_PREFIX}"`);
console.log(`🔔 Will respond when mentioned or replied to\n`);

connectToWhatsApp();
