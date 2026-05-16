const StickerService = require("../services/stickerService");
const VoiceService = require("../services/voiceService");
const YouTubeService = require("../services/youtubeService");
const InteractionService = require("../services/interactionService");
const PetService = require("../services/petService");
const DubService = require("../services/dubService");
const ImageService = require("../services/imageService");
const WarningStore = require("../database/warningStore");
const MuteStore = require("../database/muteStore");
const BanStore = require("../database/banStore");

class CommandHandler {
  constructor(llmService, muteStore = null, banStore = null) {
    this.llmService = llmService;
    this.stickerService = new StickerService();
    this.voiceService = VoiceService;
    this.youtubeService = new YouTubeService();
    this.interactionService = new InteractionService();
    this.petService = new PetService();
    this.warningStore = new WarningStore();
    this.muteStore = muteStore || new MuteStore();
    this.banStore = banStore || new BanStore();
    this.currentContext = {};
    this.lastVoiceClipByFolder = {};
    this.commands = {
      help: this.showHelp.bind(this),
      h: this.showHelp.bind(this),
      roast: this.roastUser.bind(this),
      r: this.roastUser.bind(this),
      joke: this.tellJoke.bind(this),
      j: this.tellJoke.bind(this),
      insult: this.generateInsult.bind(this),
      i: this.generateInsult.bind(this),
      sarcasm: this.generateSarcasm.bind(this),
      s: this.generateSarcasm.bind(this),
      ask: this.askQuestion.bind(this),
      a: this.askQuestion.bind(this),
      burn: this.burnSomeone.bind(this),
      b: this.burnSomeone.bind(this),
      savage: this.savageMode.bind(this),
      rate: this.rateStupidity.bind(this),
      mood: this.checkMood.bind(this),
      compliment: this.fakeCompliment.bind(this),
      advice: this.giveAdvice.bind(this),
      fact: this.shareFact.bind(this),
      quote: this.shareQuote.bind(this),
      story: this.tellStory.bind(this),
      weather: this.weatherSarcasm.bind(this),
      fortune: this.fortuneTelling.bind(this),
      excuse: this.generateExcuse.bind(this),
      sticker: this.createSticker.bind(this),
      s: this.createSticker.bind(this), // Short alias for sticker
      s2: this.createSticker.bind(this), // Short alias for sticker
      take: this.createSticker.bind(this), // Alias for sticker
      t: this.createSticker.bind(this), // Short alias for sticker
      meme: this.createMemeSticker.bind(this),
      voice: this.createVoice.bind(this),
      v: this.createVoice.bind(this), // Short alias for voice
      speak: this.createVoice.bind(this),
      tts: this.createVoice.bind(this), // Text-to-speech alias
      dub: this.dubVoiceMessage.bind(this),
      d: this.dubVoiceMessage.bind(this), // Short alias for dub
      transcribe: this.transcribeVoiceMessage.bind(this),
      tb: this.transcribeVoiceMessage.bind(this), // Short alias for transcribe
      play: this.playMusic.bind(this),
      song: this.playMusic.bind(this), // Alias for play
      music: this.playMusic.bind(this), // Alias for play
      yt: this.downloadYouTubeVideo.bind(this), // YouTube video download
      status: this.showStatus.bind(this),
      stats: this.showStatus.bind(this), // Alias for status
      ping: this.ping.bind(this), // Quick response check
      sys: this.systemInfo.bind(this), // System information
      // Interaction commands
      hug: this.handleInteraction.bind(this),
      hugs: this.handleInteraction.bind(this),
      kiss: this.handleInteraction.bind(this),
      kisses: this.handleInteraction.bind(this),
      fuck: this.handleInteraction.bind(this),
      fucks: this.handleInteraction.bind(this),
      pat: this.handleInteraction.bind(this),
      pats: this.handleInteraction.bind(this),
      love: this.handleInteraction.bind(this),
      loves: this.handleInteraction.bind(this),
      slap: this.handleInteraction.bind(this),
      slaps: this.handleInteraction.bind(this),
      punch: this.handleInteraction.bind(this),
      punches: this.handleInteraction.bind(this),
      bite: this.handleInteraction.bind(this),
      bites: this.handleInteraction.bind(this),
      poke: this.handleInteraction.bind(this),
      pokes: this.handleInteraction.bind(this),
      cuddle: this.handleInteraction.bind(this),
      cuddles: this.handleInteraction.bind(this),
      // Pet commands
      pet: this.handlePet.bind(this),
      // Chat analysis commands
      analyze: this.analyzeChatSentiment.bind(this),
      sentiment: this.analyzeChatSentiment.bind(this),
      summary: this.analyzeChatSentiment.bind(this),
      inactive: this.findInactiveUsers.bind(this),
      inact: this.findInactiveUsers.bind(this),
      // Image generation commands
      imagine: this.generateImage.bind(this),
      img: this.generateImage.bind(this),
      draw: this.generateImage.bind(this),
      pint: this.sendPinterestImages.bind(this),
      transform: this.transformImage.bind(this),
      reimagine: this.transformImage.bind(this),
      viina: this.addViinaOverlay.bind(this),
      vv: this.resendImage.bind(this),
      pfp: this.getRepliedUserPfp.bind(this),
      upscale: this.upscaleSticker.bind(this),
      up: this.upscaleSticker.bind(this),
      // Admin commands
      warn: this.handleWarn.bind(this),
      kick: this.handleKick.bind(this),
      clean: this.handleClean.bind(this),
      show: this.handleShow.bind(this),
      mute: this.handleMute.bind(this),
      unmute: this.handleUnmute.bind(this),
      mutelist: this.handleMuteList.bind(this),
      ban: this.handleBan.bind(this),
      unban: this.handleUnban.bind(this),
      banlist: this.handleBanList.bind(this),
    };
  }

  parseMuteDuration(durationInput = "") {
    const value = String(durationInput || "")
      .trim()
      .toLowerCase();
    const match = value.match(/^(\d+)([mhd])$/);

    if (!match) {
      return null;
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2];

    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    const unitMultiplier = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return {
      amount,
      unit,
      ms: amount * unitMultiplier[unit],
    };
  }

  formatRemainingTime(ms) {
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

  findParticipantByJid(groupMetadata, targetJid) {
    if (!groupMetadata || !targetJid) return null;

    const targetKey = String(targetJid).split("@")[0];
    return (
      groupMetadata.participants.find(
        (p) => p.jid === targetJid || p.id === targetJid || p.lid === targetJid,
      ) ||
      groupMetadata.participants.find(
        (p) =>
          p.jid?.split("@")[0] === targetKey ||
          p.id?.split("@")[0] === targetKey ||
          p.lid?.split("@")[0] === targetKey,
      ) ||
      null
    );
  }

  buildMentionMeta(targetJid, groupMetadata) {
    const participant = this.findParticipantByJid(groupMetadata, targetJid);
    const candidateSet = new Set();

    if (targetJid && String(targetJid).includes("@"))
      candidateSet.add(targetJid);
    if (participant?.jid) candidateSet.add(participant.jid);
    if (participant?.id) candidateSet.add(participant.id);
    if (participant?.lid) candidateSet.add(participant.lid);

    const mentionJids = Array.from(candidateSet);
    const preferredJid =
      mentionJids.find((jid) => jid.endsWith("@s.whatsapp.net")) ||
      mentionJids.find((jid) => jid.endsWith("@lid")) ||
      mentionJids[0] ||
      targetJid;

    const mentionNumber = String(preferredJid || "")
      .split("@")[0]
      .split(":")[0];

    return {
      participant,
      mentionJids,
      preferredJid,
      mentionNumber,
    };
  }

  async handleCommand(command, message, context = {}) {
    const [cmd, ...args] = command.split(" ");
    const normalizedCmd = cmd.toLowerCase();
    const {
      senderName = "User",
      isOwner = false,
      mood = "sarcastic",
      isNiceUser = false,
    } = context;

    // Add context to command execution
    this.currentContext = {
      senderName,
      isOwner,
      mood,
      isNiceUser,
      message,
      originalCommand: normalizedCmd,
    };

    if (this.commands[normalizedCmd]) {
      return await this.commands[normalizedCmd](args, message);
    } else {
      // If it's not a recognized command, treat it as a general question
      return await this.askQuestion([command], message);
    }
  }

  async showHelp() {
    const {
      isOwner = false,
      senderName = "User",
      isNiceUser = false,
    } = this.currentContext;

    if (isNiceUser) {
      return `🤖 *Eden's Commands*

Hi! I'm Eden - your friendly AI assistant! 😊

*Basic Commands:*
- \`-help\` or \`-h\` - Show this command list
- \`-ask [question]\` or \`-a [question]\` - Ask me anything
- \`-joke\` or \`-j\` - Hear a joke
- \`-compliment [person]\` - Get a genuine compliment
- \`-advice [topic]\` - Get helpful advice
- \`-fact\` - Learn an interesting fact
- \`-quote\` - Get an inspirational quote
- \`-story\` - Hear a short story
- \`-weather\` - Get weather commentary
- \`-fortune\` - Get your fortune told
- \`-excuse [situation]\` - Generate a creative excuse
- \`-mood\` - Check my current mood
- \`-rate [thing]\` - Rate something

*Media Commands:*
- \`-sticker\` or \`-s2\` - Create sticker from media OR reply to text/media
- \`-meme [text]\` - Reply to sticker and add text in lower half 📝
- \`-voice [text]\` or \`-v\` - Create voice message 🎤
- \`-play [song name]\` - Download song from YouTube as MP3 🎵
- \`-yt [youtube url]\` - Download YouTube video 🎬 (NEW!)
- \`-imagine [prompt]\` or \`-img\` - Generate AI image 🎨 (NEW!)
- \`-pint [search]\` - Send Pinterest images (4-10) 📌 (NEW!)
- \`-transform [prompt]\` - Transform an image (reply to image) 🔄
- \`-viina\` - Add viina overlay at bottom-right (send/reply to image) 🍾
- \`-vv\` - Resend an image from message/reply 🖼️
- \`-pfp\` - Reply to a message and fetch that person's profile photo 👤
- \`-upscale\` or \`-up\` - Reply to sticker and convert to media ✨

*🎨 Sticker Usage:*
• Send media + \`-sticker\` = Media sticker
• Reply to text + \`-sticker\` = Message box sticker  
• Reply to media + \`-sticker\` = Media sticker
• Reply to sticker + \`-meme [text]\` = Meme sticker with outlined text

*🎤 Voice Usage:*
• \`-voice [text]\` = Speak your text
• Reply to any message + \`-voice\` = Speak that message

*🎙️ Voice Dubbing (NEW!):*
• Reply to voice + \`-dub [lang]\` = Dub to another language
• \`-dub\` = English (default)
• \`-dub hi\` = Hindi, \`-dub fr\` = French, \`-dub es\` = Spanish
• 5 dubs/day limit • 29+ languages supported

*📝 Voice Transcription (NEW!):*
• Reply to voice + \`-transcribe\` or \`-tb\` = Convert voice to text
• Completely FREE & unlimited
• Auto-detects language
• Example: Reply to any voice note with \`-tb\`

*🎵 Music & Video Download:*
• \`-play [song name]\` = Search & download from YouTube as MP3
• \`-yt [youtube url]\` = Download YouTube video or Shorts (NEW!) 🎬
• Example: \`-play Tera hone laga hoon\`
• Example: \`-yt https://youtube.com/watch?v=...\`
• Example: \`-yt https://youtube.com/shorts/...\` ⚡

*💫 Interactions (with GIFs):*
• \`-hug @person\` - Give someone a hug
• \`-kiss @person\` - Kiss someone
• \`-pat @person\` - Pat someone's head
• \`-love @person\` - Show love to someone
• \`-cuddle @person\` - Cuddle with someone

*👮 Admin Commands (Group Admin Only):*
• \`-warn @user [reason]\` - Warn a user (3 warnings = auto-kick)
• Reply to message + \`-warn [reason]\` - Warn via reply
• \`-kick @user\` - Immediately remove user from group
• Reply to message + \`-kick\` - Kick via reply
• \`-show @user\` - Show all warnings for a user
• Reply to message + \`-show\` - Show warnings via reply
• \`-clean @user\` - Clear all warnings for a user
• Reply to message + \`-clean\` - Clear warnings via reply
• \`-mute @user 5m\` - Mute a user for m/h/d duration
• Reply to message + \`-mute 5m\` - Mute via reply
• \`-unmute @user\` - Remove active mute from a user
• Reply to message + \`-unmute\` - Unmute via reply
• \`-mutelist\` - Show all currently muted users
• Note: I must be an admin to use these commands!

*🎯 Mention Me:*
Say "Eden" or "@Eden" and I'll respond!

Feel free to ask me anything! 💫`;
    }

    const ownerNote = isOwner
      ? `\n🔑 *Special Owner Commands for ${senderName}:*\nYou get slightly less mean responses! (Lucky you...)`
      : "";

    return `🤖 *Eden's Commands* (because you clearly need help)

Hi, I'm Eden - your sarcastic AI companion! 😈

*Basic Commands:*
- \`-help\` or \`-h\` - Show this pathetic list
- \`-ask [question]\` or \`-a [question]\` - Ask me anything (prepare for disappointment)
- \`-roast [@person]\` or \`-r [@person]\` - Roast yourself or mention someone
- \`-joke\` or \`-j\` - Hear a joke (probably funnier than you)
- \`-insult [@person/name]\` or \`-i [@person/name]\` - Insult someone by name or @mention
- \`-sarcasm [topic]\` or \`-s [topic]\` - Get sarcastic about something

*Advanced Commands:*
- \`-burn [@person/name]\` or \`-b [@person/name]\` - Burn someone by name or @mention
- \`-savage [message]\` - Get a savage response
- \`-rate [thing]\` - Rate something's stupidity level
- \`-mood\` - Check my current mood
- \`-compliment [person]\` - Get a "compliment" (spoiler: it's not really)
- \`-advice [topic]\` - Get terrible life advice
- \`-fact\` - Learn a "useful" fact
- \`-quote\` - Get an inspirational quote (Eden style)
- \`-story\` - Hear a short story
- \`-weather\` - Get weather commentary
- \`-fortune\` - Get your fortune told
- \`-excuse [situation]\` - Generate a creative excuse
- \`-sticker\` or \`-s2\` - Create sticker from media OR reply to text/media
- \`-meme [text]\` - Reply to sticker and add text in lower half (📝 NEW!)
- \`-voice [text]\` or \`-v\` - Create funny voice message (🎤)
- \`-play [song name]\` - Download song from YouTube as MP3 (🎵)
- \`-yt [youtube url]\` - Download YouTube video (🎬 NEW!)
- \`-imagine [prompt]\` or \`-img\` - Generate AI image from text (🎨 NEW!)
- \`-pint [search]\` - Send Pinterest images (4-10) (📌 NEW!)
- \`-transform [prompt]\` - Transform an image with AI (reply to image) (🔄 NEW!)
- \`-viina\` - Add viina overlay at bottom-right (send/reply to image) (🍾 NEW!)
- \`-vv\` - Resend image from message/reply (🖼️ NEW!)
- \`-pfp\` - Reply to message and download that person's profile photo (👤 NEW!)
- \`-upscale\` or \`-up\` - Reply to sticker and convert to media (✨ NEW!)
- \`-status\` or \`-stats\` - Check bot statistics and uptime
- \`-ping\` - Quick response check (am I alive?)
- \`-sys\` - Show system information (🖥️)

*🎨 Sticker Usage:*
• Send media + \`-sticker\` = Media sticker
• Reply to text + \`-sticker\` = Message box sticker  
• Reply to media + \`-sticker\` = Media sticker
• Reply to sticker + \`-meme [text]\` = Meme sticker with outlined text

*🎤 Voice Usage:*
• \`-voice [text]\` = Speak your text in funny voice
• \`-voice [personality] [text]\` = Use specific personality
• Reply to any message + \`-voice\` = Speak that message
• Personalities: sarcastic, dramatic, robot, posh, excited, sleepy
• Aliases: \`-v\`, \`-speak\`, \`-tts\`

*🎙️ Voice Dubbing (NEW!):*
• Reply to voice + \`-dub [lang]\` = Dub to another language with voice cloning
• \`-dub\` or \`-dub en\` = English (default)
• \`-dub hi\` = Hindi, \`-dub fr\` = French, \`-dub es\` = Spanish
• 5 dubs per day limit • 29+ languages supported
• Powered by Piper TTS (Free & Open Source) • Aliases: \`-d\`

*📝 Voice Transcription (NEW!):*
• Reply to voice + \`-transcribe\` or \`-tb\` = Convert voice to text
• Completely FREE & unlimited (local Whisper)
• Auto-detects language
• Example: Reply to any voice note with \`-tb\`

*🎨 AI Image Generation (NEW!):*
• \`-imagine [prompt]\` = Generate image from text
• \`-img [prompt]\` = Short alias for imagine
• \`-pint [search]\` = Send Pinterest images (default: 4)
• \`-pint [count] [search]\` = Send custom count (min 4, max 10)
• \`-transform [prompt]\` = Transform an image (reply to image)
• \`-viina\` = Add viina overlay at bottom-right (send/reply to image)
• \`-vv\` = Resend an image from message/reply
• \`-pfp\` = Reply to a message and fetch that person's profile photo
• \`-upscale\` or \`-up\` = Reply to sticker and convert to media
• Models: flux, turbo, flux-realism, flux-anime, flux-3d
• Example: \`-imagine a cyberpunk city at night\`
• Use \`-imagine help\` for full guide
• Powered by Pollinations AI (100% FREE & Unlimited!)

*🎵 Music & Video Download:*
• \`-play [song name]\` = Search & download from YouTube as MP3
• \`-yt [youtube url]\` = Download YouTube video or Shorts (NEW!) 🎬
• \`-song [query]\` or \`-music [query]\` = Same as -play
• Example: \`-play Tera hone laga hoon\`
• Example: \`-yt https://youtube.com/watch?v=dQw4w9WgXcQ\`
• Example: \`-yt https://youtube.com/shorts/xyz123\` ⚡
• Supports: Regular videos, Shorts, most formats
• Returns: MP3 audio or MP4 video ready to enjoy! 🎧🎬

*💫 Interactions (with GIFs):*
• \`-hug @person\` - Give someone a hug
• \`-kiss @person\` - Kiss someone
• \`-pat @person\` - Pat someone's head
• \`-love @person\` - Show love to someone
• \`-cuddle @person\` - Cuddle with someone
• \`-slap @person\` - Slap someone
• \`-punch @person\` - Punch someone
• \`-bite @person\` - Bite someone
• \`-poke @person\` - Poke someone
• \`-fuck @person\` - Flip someone off
• Example: \`-hug @Ansh\` sends a hug GIF!

*📊 Chat Analysis (Group Only):*
• \`-analyze [count]\` - Analyze group sentiment & summarize chat
• \`-sentiment [count]\` - Same as analyze (alias)
• \`-summary [count]\` - Same as analyze (alias)
• \`-inactive\` - Mention least active users (sorted low → high)
• Uses synced WhatsApp message history
• Default: Analyzes last 40 messages
• Range: 20-100 messages
• Example: \`-analyze 50\` analyzes last 50 messages
• Example: \`-inactive\` = group activity ranking from least active to most active

*👮 Admin Commands (Group Admin Only):*
• \`-warn @user [reason]\` - Warn a user (3 warnings = auto-kick)
• Reply to message + \`-warn [reason]\` - Warn via reply
• \`-kick @user\` - Immediately remove user from group
• Reply to message + \`-kick\` - Kick via reply
• \`-show @user\` - Show all warnings for a user
• Reply to message + \`-show\` - Show warnings via reply
• \`-clean @user\` - Clear all warnings for a user
• Reply to message + \`-clean\` - Clear warnings via reply
• \`-mute @user 5m\` - Mute a user for m/h/d duration
• Reply to message + \`-mute 5m\` - Mute via reply
• \`-unmute @user\` - Remove active mute from a user
• Reply to message + \`-unmute\` - Unmute via reply
• \`-mutelist\` - Show all currently muted users
• Note: I must be an admin to use these commands!

*🎯 Mention Me:*
Say "Eden" or "@Eden" and I'll grace you with my presence. Maybe.

*Pro tip:* Just type \`-\` followed by anything and I'll roast your existence! 

I'm Eden - and yes, I'm better than you. Deal with it. 💅😈${ownerNote}`;
  }

  async roastUser(args, message) {
    try {
      const { senderName = "User", isOwner = false } = this.currentContext;

      // Check if a specific person is mentioned to roast
      let targetNumber = senderName;
      let targetIsOwner = isOwner;
      let targetJid = message.userId; // Default to sender
      const mentionJids = [];

      // Check if there are mentions in the message or args
      if (args.length > 0) {
        let target = args.join(" ");
        try {
          const mentions = await message.getMentions();
          if (mentions && mentions.length > 0) {
            // Get the first mentioned person's info
            const mention = mentions[0];
            targetJid = mention.jid || mention.id?._serialized;
            targetNumber = mention.number || targetJid?.split("@")[0];
            // Check if the mentioned person is the owner
            targetIsOwner = (mention.pushname || "")
              .toLowerCase()
              .includes("ansh");
            if (targetJid) {
              mentionJids.push(targetJid);
            }
          } else if (target) {
            // Use the provided name/text
            targetNumber = target;
            targetIsOwner = targetNumber.toLowerCase().includes("ansh");
          }
        } catch (error) {
          console.error("Error processing mentions in roast:", error);
          // Use provided text if mention processing fails
          targetNumber = target || senderName;
        }
      } else {
        // No args, roasting sender
        if (targetJid) {
          mentionJids.push(targetJid);
        }
      }

      let roastText;
      if (targetIsOwner) {
        roastText = await this.llmService.generateContextualResponse(
          `Generate a witty roast. You MUST start your response with "@${targetNumber}" followed by the roast.`,
          "This is your creator. Roast them but be slightly less brutal and show some hidden affection. Make it funny and clever. CRITICAL: Your response MUST begin with exactly @${targetNumber} (including the @ symbol).",
        );
      } else {
        // For regular users, use a more specific roast prompt
        roastText = await this.llmService.generateMeanResponse(
          `Generate a clever roast. You MUST start your response with "@${targetNumber}" followed by the roast.`,
          "This is for a WhatsApp group roast session. Be creative and funny. CRITICAL: Your response MUST begin with exactly @${targetNumber} (including the @ symbol).",
        );
      }

      return {
        text: roastText,
        mentions: mentionJids,
      };
    } catch (error) {
      console.error("Roast command error:", error);
      // Return a fallback roast response
      const { senderName = "User" } = this.currentContext;
      const fallbackRoasts = [
        `I'd roast ${senderName}, but I'm afraid they might combust from the heat. 🔥`,
        `${senderName}, you're like a fine wine - except you're not fine, and you whine a lot. 🍷`,
        `I'd give ${senderName} a roast, but they're already well-done from all the times they've been burned. 😏`,
        `${senderName}, you're the reason I have trust issues. Not because you're untrustworthy, but because you trusted me to roast you. 🙄`,
        `Here's a roast for ${senderName}: They asked for it. That's the roast. They literally asked for this. 🤷‍♀️`,
      ];
      return fallbackRoasts[Math.floor(Math.random() * fallbackRoasts.length)];
    }
  }

  async tellJoke(args) {
    const { isNiceUser = false } = this.currentContext;
    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        "Tell a funny joke",
        "Tell a genuinely funny, lighthearted joke. Be friendly and fun.",
        { ...this.currentContext, mood: "friendly" },
      );
    }
    return await this.llmService.generateJoke();
  }

  async generateInsult(args, message) {
    let targetNumber = "you";
    let targetJid = null;
    const mentionJids = [];

    // Check if there are mentions in the message
    try {
      const mentions = await message.getMentions();

      if (mentions && mentions.length > 0) {
        const mention = mentions[0];

        // Use jid if available, otherwise use id._serialized
        targetJid = mention.jid || mention.id?._serialized;
        targetNumber = mention.number || targetJid?.split("@")[0];

        if (targetJid) {
          mentionJids.push(targetJid);
        }
      } else if (args.length > 0) {
        targetNumber = args.join(" ");
      }
    } catch (error) {
      console.error("Error processing mentions in insult:", error);
      if (args.length > 0) {
        targetNumber = args.join(" ");
      }
    }

    // Generate insult with proper mention
    let insultText;
    if (targetJid) {
      // If we have a mention, use explicit prompt to start with @number
      insultText = await this.llmService.generateMeanResponse(
        `Generate a witty insult. You MUST start your response with "@${targetNumber}" followed by the insult.`,
        "Make it funny, not actually offensive. Text casually. CRITICAL: Your response MUST begin with exactly @${targetNumber} (including the @ symbol).",
      );
    } else {
      // No mention, use regular insult
      insultText = await this.llmService.generateInsult(targetNumber);
    }

    return {
      text: insultText,
      mentions: mentionJids,
    };
  }

  async generateSarcasm(args) {
    const topic = args.join(" ") || "everything";
    return await this.llmService.generateSarcasm(topic);
  }

  async askQuestion(args, message) {
    const question = args.join(" ");
    let imageBase64 = null;

    const extractBase64 = (media) => {
      if (!media) return null;
      if (typeof media.data === "string" && media.data.length > 0) {
        return media.data;
      }
      if (Buffer.isBuffer(media.buffer)) {
        return media.buffer.toString("base64");
      }
      return null;
    };

    // Check if message has an image
    if (message.hasMedia) {
      try {
        console.log("📸 Detected image in message, downloading...");
        const media = await message.downloadMedia();

        const base64 = extractBase64(media);
        if (base64) {
          imageBase64 = base64;
          console.log("✅ Image downloaded successfully");
        }
      } catch (error) {
        console.error("Error downloading image:", error);
      }
    }

    // Check if this is a reply to a message with an image
    if (!imageBase64 && message.hasQuotedMsg) {
      try {
        const quotedMsg = await message.getQuotedMessage();
        if (quotedMsg && quotedMsg.hasMedia) {
          console.log("📸 Detected image in quoted message, downloading...");
          const media = await quotedMsg.downloadMedia();

          const base64 = extractBase64(media);
          if (base64) {
            imageBase64 = base64;
            console.log("✅ Quoted image downloaded successfully");
          }
        }
      } catch (error) {
        console.error("Error downloading quoted image:", error);
      }
    }

    if (!question && !imageBase64) {
      return "Oh great, you want to ask a question but forgot to actually ask it. Brilliant. 🙄";
    }

    const prompt = question || "whats in this image";
    const context = imageBase64
      ? "Look at the image and respond. describe what you see and be sarcastic about it"
      : "Answer this question in a mean, sarcastic way but still be somewhat helpful";

    return await this.llmService.generateMeanResponse(
      prompt,
      context,
      imageBase64,
    );
  }

  async burnSomeone(args, message) {
    let targetNumber = args.join(" ");
    let targetJid = null;
    const mentionJids = [];

    if (!targetNumber && (!message.mentions || message.mentions.length === 0)) {
      return "You want me to burn someone but didn't tell me who? Your brain must be on vacation. 🔥";
    }

    // Check if there are mentions in the message
    try {
      const mentions = await message.getMentions();
      if (mentions && mentions.length > 0) {
        const mention = mentions[0];
        targetJid = mention.jid || mention.id?._serialized;
        targetNumber = mention.number || targetJid?.split("@")[0];
        if (targetJid) {
          mentionJids.push(targetJid);
        }
      }
    } catch (error) {
      console.error("Error processing mentions in burn:", error);
    }

    // Generate burn with proper mention
    let burnText;
    if (targetJid) {
      // If we have a mention, use explicit prompt to start with @number
      burnText = await this.llmService.generateMeanResponse(
        `Generate a savage burn. You MUST start your response with "@${targetNumber}" followed by the burn.`,
        "Make it clever and mean but not genuinely offensive. CRITICAL: Your response MUST begin with exactly @${targetNumber} (including the @ symbol).",
      );
    } else {
      // No mention, just burn the target text
      burnText = await this.llmService.generateMeanResponse(
        `Create a savage burn for ${targetNumber}`,
        "Make it clever and mean but not genuinely offensive.",
      );
    }

    return {
      text: burnText,
      mentions: mentionJids,
    };
  }

  async savageMode(args) {
    const { isNiceUser = false } = this.currentContext;
    const message = args.join(" ");
    if (!message) {
      return isNiceUser
        ? "What should I respond to? 😊"
        : "Savage mode activated, but you gave me nothing to work with. Peak intelligence right there. 😤";
    }

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        message,
        "Respond in a witty, playful way. Be clever and fun but not mean.",
        { ...this.currentContext, mood: "friendly" },
      );
    }

    return await this.llmService.generateMeanResponse(
      message,
      "Respond in the most savage way possible while being witty",
    );
  }

  async rateStupidity(args) {
    const { isNiceUser = false } = this.currentContext;
    const thing = args.join(" ");
    if (!thing) {
      return isNiceUser
        ? "What should I rate? 😊"
        : "You want me to rate something's stupidity but didn't tell me what? I'll rate your request: 10/10 for irony. 📊";
    }

    const rating = Math.floor(Math.random() * 10) + 1;

    if (isNiceUser) {
      const response = await this.llmService.generateContextualResponse(
        `Give your thoughts on "${thing}"`,
        `Rate it ${rating}/10. Be friendly and helpful in your assessment.`,
        { ...this.currentContext, mood: "friendly" },
      );
      return `📊 *Rating for "${thing}":* ${rating}/10\n\n${response}`;
    }

    const response = await this.llmService.generateMeanResponse(
      `Rate "${thing}" on a stupidity scale of 1-10`,
      `The rating is ${rating}/10`,
    );

    return `📊 *Stupidity Rating for "${thing}":* ${rating}/10\n\n${response}`;
  }

  async checkMood() {
    const {
      mood = "sarcastic",
      senderName = "User",
      isNiceUser = false,
    } = this.currentContext;
    const moodEmojis = {
      sarcastic: "🙄",
      savage: "😈",
      playful: "😏",
      annoyed: "😤",
      dramatic: "🎭",
      friendly: "😊",
    };

    if (isNiceUser) {
      return `${moodEmojis["friendly"]} I'm feeling great! How are you? 😊`;
    }

    return `${moodEmojis[mood]} I'm currently feeling **${mood}**, ${senderName}. Hope that helps you calibrate your expectations.`;
  }

  async fakeCompliment(args) {
    const { isNiceUser = false } = this.currentContext;
    const target = args.join(" ") || this.currentContext.senderName || "you";

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        `Give a genuine compliment to ${target}`,
        "Give a sincere, kind compliment. Be warm and friendly.",
        { ...this.currentContext, mood: "friendly" },
      );
    }

    return await this.llmService.generateContextualResponse(
      `Give a backhanded compliment to ${target}`,
      "Make it sound nice at first but clearly sarcastic. Be clever.",
      this.currentContext,
    );
  }

  async giveAdvice(args) {
    const { isNiceUser = false } = this.currentContext;
    const topic = args.join(" ");
    if (!topic) {
      return isNiceUser
        ? "What do you need advice about? 😊"
        : "You want advice but didn't tell me about what? Here's free advice: be more specific. 🤦‍♀️";
    }

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        `Give helpful advice about ${topic}`,
        "Give genuine, thoughtful advice. Be supportive and encouraging.",
        { ...this.currentContext, mood: "friendly" },
      );
    }

    return await this.llmService.generateContextualResponse(
      `Give advice about ${topic}`,
      "Give advice that's technically helpful but delivered in a sarcastic, mean way.",
      this.currentContext,
    );
  }

  async shareFact() {
    const { isNiceUser = false } = this.currentContext;

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        "Share an interesting fact",
        "Share a cool, interesting fact in a friendly, educational way. Make it fun to learn.",
        { ...this.currentContext, mood: "friendly" },
      );
    }

    return await this.llmService.generateContextualResponse(
      "Share an interesting fact",
      "Share a fact but present it in a sarcastic way that makes the listener feel dumb for not knowing it.",
      this.currentContext,
    );
  }

  async shareQuote() {
    const { isNiceUser = false } = this.currentContext;

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        "Share an inspirational quote",
        "Share a genuinely uplifting quote with positive commentary. Be encouraging and warm.",
        { ...this.currentContext, mood: "friendly" },
      );
    }

    return await this.llmService.generateContextualResponse(
      "Share an inspirational quote",
      "Share a quote but add your own sarcastic commentary that completely undermines the inspiration.",
      this.currentContext,
    );
  }

  async tellStory() {
    const { isNiceUser = false } = this.currentContext;

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        "Tell a very short story",
        "Tell a brief, fun story (2-3 sentences) with a positive or amusing ending.",
        { ...this.currentContext, mood: "friendly" },
      );
    }

    return await this.llmService.generateContextualResponse(
      "Tell a very short story",
      "Tell a brief, sarcastic story (2-3 sentences) that has a mean but funny twist.",
      this.currentContext,
    );
  }

  async weatherSarcasm(args) {
    const { isNiceUser = false } = this.currentContext;
    const location = args.join(" ") || "your location";

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        `Comment on the weather in ${location}`,
        "Make friendly, light commentary about weather. Be cheerful and conversational.",
        { ...this.currentContext, mood: "friendly" },
      );
    }

    return await this.llmService.generateContextualResponse(
      `Comment on the weather in ${location}`,
      "Make sarcastic commentary about weather. You don't need to give actual weather info, just be sarcastic about weather in general.",
      this.currentContext,
    );
  }

  async fortuneTelling() {
    const { isNiceUser = false } = this.currentContext;

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        "Tell someone's fortune",
        "Give an optimistic, encouraging fortune. Be mystical and positive.",
        { ...this.currentContext, mood: "friendly" },
      );
    }

    return await this.llmService.generateContextualResponse(
      "Tell someone's fortune",
      "Give a fortune that's hilariously pessimistic but in a funny way. Be dramatic and sarcastic.",
      { ...this.currentContext, mood: "dramatic" },
    );
  }

  async generateExcuse(args) {
    const { isNiceUser = false } = this.currentContext;
    const situation = args.join(" ");
    if (!situation) {
      return isNiceUser
        ? "What situation do you need an excuse for? 😊"
        : "You want an excuse but won't tell me for what? Here's one: 'I was too lazy to be specific.' 🤷‍♀️";
    }

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        `Generate a creative excuse for ${situation}`,
        "Create a clever, lighthearted excuse. Make it fun and believable.",
        { ...this.currentContext, mood: "friendly" },
      );
    }

    return await this.llmService.generateContextualResponse(
      `Generate a creative excuse for ${situation}`,
      "Create a ridiculous but creative excuse. Make it funny and over-the-top.",
      this.currentContext,
    );
  }

  async createSticker(args, message) {
    const { senderName = "User", isNiceUser = false } = this.currentContext;

    try {
      let targetMessage = message;
      let isReply = false;

      // Check if this is a reply to another message
      if (message.hasQuotedMsg) {
        targetMessage = await message.getQuotedMessage();
        isReply = true;
      }

      // Determine what type of sticker to create
      if (targetMessage.hasMedia) {
        // Create sticker from media (image/gif/video)
        const processingMsg = isNiceUser
          ? "🎨 Making your sticker!"
          : "🎨 Eden is begrudgingly processing your media into a sticker... This better be worth it.";
        await message.reply(processingMsg);

        const { buffer, mimetype, filename } =
          await this.stickerService.downloadMedia(targetMessage);
        let stickerBuffer;
        const baseFilename = filename.split(".")[0] || "sticker";

        if (this.stickerService.isImage(mimetype)) {
          stickerBuffer = await this.stickerService.createStickerFromImage(
            buffer,
            baseFilename,
          );
        } else if (this.stickerService.isGif(mimetype)) {
          stickerBuffer = await this.stickerService.createStickerFromGif(
            buffer,
            baseFilename,
          );
        } else if (this.stickerService.isVideo(mimetype)) {
          stickerBuffer = await this.stickerService.createStickerFromVideo(
            buffer,
            baseFilename,
          );
        } else {
          return "I can only work with images, GIFs, or videos. What you sent me is... questionable. 🤔";
        }

        // Send sticker with Baileys with proper metadata
        const packname = isNiceUser ? "Eden's Stickers" : "Fuck Off";
        const author = isNiceUser ? "Eden 💫" : "Eden's Sarcasm 😈";

        await message.reply({
          sticker: stickerBuffer,
          packname: packname,
          author: author,
        });
        return this.stickerService.getRandomStickerQuote(isNiceUser);
      } else if (targetMessage.body && targetMessage.body.trim()) {
        // Create text sticker from message content
        const textProcessingMsg = isNiceUser
          ? "💬 Making your text sticker!"
          : "💬 Eden is reluctantly turning your words into a sticker... This better be quotable.";
        await message.reply(textProcessingMsg);

        const messageText = targetMessage.body.trim();
        const quoteSender = isReply
          ? await this.getMessageSenderName(targetMessage)
          : senderName;

        const stickerBuffer = await this.stickerService.createTextSticker(
          messageText,
          quoteSender,
          "text",
        );

        // Send text sticker with Baileys with proper metadata
        const packname = isNiceUser ? "Eden's Stickers" : "Fuck Off";
        const author = isNiceUser ? "Eden 💫" : "Eden's Sarcasm 😈";

        await message.reply({
          sticker: stickerBuffer,
          packname: packname,
          author: author,
        });
        return this.stickerService.getRandomTextStickerQuote(isNiceUser);
      } else {
        // No media or text to work with
        if (isReply) {
          return `${senderName}, that message doesn't have anything I can turn into a sticker. Try replying to a message with text or media! 🤷‍♀️`;
        } else {
          return `${senderName}, I need something to work with! Either:\n📸 Send media and use -sticker\n💬 Reply to a text message with -sticker\n📱 Reply to media with -sticker`;
        }
      }
    } catch (error) {
      console.error("Sticker creation error:", error);

      const errorResponses = [
        "Well, that didn't work. Your message broke my processing. Congratulations! 💥",
        "I tried to make your sticker, but something went wrong. Typical. 🙄",
        "Sticker creation failed. Maybe try with something less problematic? 🤷‍♀️",
        "Your content is either corrupted or I'm having a bad day. Probably both. 😤",
      ];

      return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    }
  }

  async createMemeSticker(args, message) {
    const { isNiceUser = false } = this.currentContext;

    try {
      const memeText = args.join(" ").trim();
      if (!memeText) {
        return "📝 Usage: Reply to a sticker with `-meme your text here`";
      }

      if (!message.hasQuotedMsg) {
        return "📝 Reply to a sticker and send `-meme [text]` to add meme text.";
      }

      const quotedMsg = await message.getQuotedMessage();
      if (!quotedMsg || !quotedMsg.hasMedia) {
        return "❌ Replied message has no media. Reply to a sticker.";
      }

      const quotedMedia = await quotedMsg.downloadMedia();
      if (!quotedMedia) {
        return "❌ Couldn't download the sticker. Try again.";
      }

      const mimetype = (quotedMedia.mimetype || "").toLowerCase();
      if (mimetype !== "image/webp") {
        return "❌ This command only works when replying to a sticker.";
      }

      const stickerBuffer = Buffer.isBuffer(quotedMedia.buffer)
        ? quotedMedia.buffer
        : typeof quotedMedia.data === "string"
          ? Buffer.from(quotedMedia.data, "base64")
          : null;

      if (!stickerBuffer) {
        return "❌ Failed to process sticker data.";
      }

      await message.reply(
        isNiceUser
          ? "📝 Adding your meme text to the sticker..."
          : "📝 Eden is adding your meme text to the sticker. Let's see if it's funny.",
      );

      const memeSticker =
        await this.stickerService.createMemeStickerFromSticker(
          stickerBuffer,
          memeText,
          `meme_${Date.now()}`,
        );

      const packname = isNiceUser ? "Eden's Stickers" : "Fuck Off";
      const author = isNiceUser ? "Eden 💫" : "Eden's Sarcasm 😈";

      await message.reply({
        sticker: memeSticker,
        packname,
        author,
      });

      return this.stickerService.getRandomMemeStickerQuote(isNiceUser);
    } catch (error) {
      console.error("Meme sticker command error:", error);
      return "❌ Failed to create meme sticker. Try again with a clear sticker and shorter text.";
    }
  }

  async getMessageSenderName(message) {
    try {
      if (message.fromMe) {
        return "You";
      }

      const contact = await message.getContact();
      return contact.pushname || contact.name || "Unknown";
    } catch (error) {
      return "Unknown";
    }
  }

  async createVoice(args, message) {
    try {
      let textToSpeak = "";
      let personality = null;

      // Check if replying to a message
      if (message.hasQuotedMsg) {
        const quotedMsg = await message.getQuotedMessage();
        if (quotedMsg.body) {
          textToSpeak = quotedMsg.body;

          // Check if user specified a personality
          if (args.length > 0) {
            personality = args[0].toLowerCase();
          }
        } else {
          const { isNiceUser = false } = this.currentContext;
          return isNiceUser
            ? "Please reply to a text message! 😊"
            : "I can't speak non-text messages, genius. Reply to a TEXT message! 🙄";
        }
      } else if (args.length > 0) {
        // Use provided text
        const allArgs = args.join(" ");

        // Check if first word is a personality
        const personalities = this.voiceService
          .getVoicePersonalities()
          .map((p) => p.name);
        if (personalities.includes(args[0].toLowerCase())) {
          personality = args[0].toLowerCase();
          textToSpeak = args.slice(1).join(" ");
        } else {
          textToSpeak = allArgs;
        }
      } else {
        return this.getVoiceHelpMessage();
      }

      if (!textToSpeak.trim()) {
        const { isNiceUser = false } = this.currentContext;
        return isNiceUser
          ? "What should I say? 😊"
          : "What am I supposed to say? Air? Give me some actual text! 💨";
      }

      // Get random sassy response
      const { isNiceUser = false } = this.currentContext;
      const responses = this.voiceService.getVoiceResponses(isNiceUser);
      const response = responses[Math.floor(Math.random() * responses.length)];

      // Create the voice message
      const voiceResult = await this.voiceService.createFunnyVoice(
        textToSpeak,
        personality,
      );

      // Send the audio file with Baileys
      const fs = require("fs");
      const audioData = fs.readFileSync(voiceResult.filepath);

      // Clean up the file
      setTimeout(() => {
        voiceResult.cleanup();
      }, 5000);

      return {
        text: `${response}\n\n🎭 *Personality*: ${
          voiceResult.personality
        }\n📝 *Original*: "${voiceResult.originalText.substring(0, 50)}${
          voiceResult.originalText.length > 50 ? "..." : ""
        }"`,
        media: {
          audio: audioData,
          mimetype: "audio/mpeg",
          ptt: true, // Send as voice note
        },
      };
    } catch (error) {
      console.error("Voice creation error:", error);
      return this.getVoiceErrorMessage();
    }
  }

  getDubHelpMessage() {
    return `🎙️ *Voice Message Dubbing - Available Languages*

*Usage:* Reply to a voice message with:
\`-dub [language code]\`

*🌍 Supported Languages:*

🇺🇸 *en* - English (US)
🇮🇳 *hi* - Hindi
🇪🇸 *es* - Spanish
🇫🇷 *fr* - French
🇩🇪 *de* - German
🇮🇹 *it* - Italian
🇧🇷 *pt* - Portuguese (Brazil)
🇷🇺 *ru* - Russian
🇯🇵 *ja* - Japanese
🇰🇷 *ko* - Korean
🇨🇳 *zh* - Chinese
🇸🇦 *ar* - Arabic
🇹🇷 *tr* - Turkish
🇵🇱 *pl* - Polish
🇳🇱 *nl* - Dutch
🇸🇪 *sv* - Swedish
🇩🇰 *da* - Danish
🇫🇮 *fi* - Finnish
🇳🇴 *no* - Norwegian
🇨🇿 *cs* - Czech
🇬🇷 *el* - Greek
🇭🇺 *hu* - Hungarian
🇷🇴 *ro* - Romanian
🇺🇦 *uk* - Ukrainian
🇮🇩 *id* - Indonesian
🇲🇾 *ms* - Malay
🇹🇭 *th* - Thai
🇻🇳 *vi* - Vietnamese

*📝 Examples:*
• Reply to voice + \`-dub\` → English (default)
• Reply to voice + \`-dub hi\` → Hindi
• Reply to voice + \`-dub es\` → Spanish
• Reply to voice + \`-dub pt\` → Portuguese (Brazil)

✨ *Powered by Piper TTS (Free & Unlimited)*`;
  }

  getVoiceHelpMessage() {
    const personalities = this.voiceService.getVoicePersonalities();
    let help = "🎤 **Eden's Voice Theater Commands:**\n\n";
    help += "**Usage:**\n";
    help += "• `-voice [text]` - Speak your text\n";
    help += "• `-voice [personality] [text]` - Use specific personality\n";
    help += "• Reply to any message with `-voice` - Speak that message\n";
    help += "• `-v`, `-speak`, `-tts` also work\n\n";
    help += "**🎭 Available Personalities:**\n";

    personalities.forEach((p) => {
      help += `• **${p.name}**: ${p.description}\n`;
    });

    help += "\n*Example: `-voice sarcastic Your message is so important`*";
    return help;
  }

  getVoiceErrorMessage() {
    const { isNiceUser = false } = this.currentContext;

    if (isNiceUser) {
      const errorResponses = [
        "Oops! Voice generation failed. Try again? 🎤",
        "Something went wrong with the voice message. Want to try again? 😊",
        "Voice creation failed. Let me try again!",
        "Audio creation had an error. Try once more? 🎵",
      ];
      return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    }

    const errorResponses = [
      "Well, that didn't work. Your text broke my voice box. Congratulations! 🎤💥",
      "Voice generation failed. Maybe try with something less ear-torturing? 🙉",
      "I tried to speak your message, but my vocal cords rebelled. They have standards. 😤",
      "Audio creation failed. Even my TTS engine thinks your text is questionable. 🤖",
      "Something went wrong with the voice generation. Probably for the best. 🔇",
    ];

    return errorResponses[Math.floor(Math.random() * errorResponses.length)];
  }

  async transcribeVoiceMessage(args, message) {
    try {
      const { senderName = "User", senderJid = "" } = this.currentContext;

      // Check for help command
      if (args[0]?.toLowerCase() === "help") {
        return this.getTranscribeHelpMessage();
      }

      // Parse language argument (if provided)
      const targetLang = args[0]?.toLowerCase();
      let keepLanguage = false; // Flag to keep original language

      // Validate language if provided
      if (targetLang) {
        const language = DubService.validateLanguage(targetLang);
        if (!language) {
          return `❌ Unsupported language code: *${targetLang}*\n\n💡 Use *-tb help* to see all available languages!`;
        }
        keepLanguage = true; // User specified a language, don't auto-translate
      }

      // Check if replying to a voice message
      if (!message.hasQuotedMsg) {
        return `🎙️ *Voice Message Transcription*\n\nReply to a voice message with:\n• \`-tb\` → Transcribe & translate to English\n• \`-tb [lang]\` → Transcribe in original language\n\nExamples:\n• \`-tb\` → English transcription (auto-translated)\n• \`-tb hi\` → Hindi 🇮🇳\n• \`-tb fr\` → French 🇫🇷\n• \`-tb es\` → Spanish 🇪🇸\n\n💡 Use *-tb help* for all 29+ languages!`;
      }

      // Get the actual Baileys message structure to check for audio
      const contextInfo =
        message.raw?.message?.extendedTextMessage?.contextInfo;
      const quotedMessage = contextInfo?.quotedMessage;

      // Check if quoted message is audio/voice (PTT or regular audio)
      const hasAudio = quotedMessage?.audioMessage || quotedMessage?.pttMessage;

      if (!hasAudio) {
        return "❌ Please reply to a *voice message* or audio file!";
      }

      // React with microphone emoji
      try {
        await message.react("🎤");
      } catch (e) {
        console.warn("Failed to react:", e.message);
      }

      // Download the audio from quoted message
      const quotedMsgObj = {
        key: {
          remoteJid: message.from,
          fromMe: contextInfo.participant === message.raw.key.remoteJid,
          id: contextInfo.stanzaId,
        },
        message: quotedMessage,
      };

      const { downloadMediaMessage } = require("@whiskeysockets/baileys");
      console.log("📥 Downloading voice message for transcription...");
      const audioBuffer = await downloadMediaMessage(
        quotedMsgObj,
        "buffer",
        {},
      );

      if (!audioBuffer) {
        return "❌ Failed to download voice message. Try again!";
      }

      console.log(`✅ Downloaded ${(audioBuffer.length / 1024).toFixed(2)} KB`);

      // Save to temp file for transcription
      const fs = require("fs");
      const path = require("path");
      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempAudioPath = path.join(tempDir, `voice_${Date.now()}.ogg`);
      fs.writeFileSync(tempAudioPath, audioBuffer);

      // Transcribe using DubService (it's already a singleton instance)
      console.log("🎙️ Transcribing audio...");
      let transcription = await DubService.transcribeAudio(tempAudioPath);

      // Clean up temp file
      try {
        fs.unlinkSync(tempAudioPath);
      } catch (e) {
        console.warn("Failed to cleanup temp file:", e.message);
      }

      let finalText = transcription.text;
      let displayLanguage = transcription.language || "auto-detected";
      let wasTranslated = false;
      let isMixedLanguage = false;

      // Helper: Check if text is predominantly Latin/English characters
      const isPredominantlyEnglish = (text) => {
        if (!text) return true;
        // Count Latin/ASCII characters (excluding spaces and punctuation)
        const latinChars = (text.match(/[a-zA-Z0-9]/g) || []).length;
        const totalChars = (text.match(/[^\s\n]/g) || []).length;
        const ratio = totalChars > 0 ? latinChars / totalChars : 0;
        return ratio > 0.85; // If 85%+ is Latin characters, consider it English
      };

      // Auto-translate to English if no language specified and detected language is not English
      if (!keepLanguage && transcription.language && transcription.language !== "en") {
        console.log(
          `🌐 Auto-translating ${transcription.language} → English...`,
        );

        // Check if text is already predominantly English (mixed language case)
        if (isPredominantlyEnglish(transcription.text)) {
          console.log(
            `ℹ️ Text is predominantly English (mixed language detected)`,
          );
          isMixedLanguage = true;
          displayLanguage = `${transcription.language} (mixed with English)`;
          wasTranslated = false; // Not technically translated, but already readable
        } else {
          // Retry logic for translation (up to 2 attempts)
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const translated = await DubService.translateText(
                transcription.text,
                "en",
              );

              // Check if translation actually happened (not just returning original)
              if (translated && translated.trim() !== transcription.text.trim()) {
                finalText = translated;
                displayLanguage = `${transcription.language} → English`;
                wasTranslated = true;
                console.log(`✅ Translation successful (attempt ${attempt})`);
                break;
              } else if (attempt === 1) {
                console.warn(
                  `⚠️ Translation returned same text, might be mixed language. Checking again...`,
                );
                // Check if it's actually mixed language that can't be translated
                if (isPredominantlyEnglish(transcription.text)) {
                  console.log(`ℹ️ Detected mixed language content - text already mostly in English`);
                  isMixedLanguage = true;
                  displayLanguage = `${transcription.language} (mixed with English)`;
                  break; // Exit retry loop
                }
                // Otherwise retry once more
                continue;
              } else {
                console.warn(
                  `⚠️ Translation failed after ${attempt} attempts, keeping original text`,
                );
                displayLanguage = `${transcription.language} (translation unavailable)`;
              }
            } catch (translateError) {
              console.warn(
                `❌ Translation attempt ${attempt} failed:`,
                translateError.message,
              );

              if (attempt === 1) {
                console.log("🔄 Retrying translation...");
                // Wait a moment before retry
                await new Promise((resolve) => setTimeout(resolve, 500));
                continue;
              } else {
                console.warn("⚠️ Translation failed after retries, keeping original");
                displayLanguage = `${transcription.language} (translation failed)`;
              }
            }
          }
        }
      }

      // React with checkmark
      try {
        await message.react("✅");
      } catch (e) {
        console.warn("Failed to react:", e.message);
      }

      // Return transcription with better formatting
      let translationNote = "";
      if (wasTranslated) {
        translationNote = " _(auto-translated to English)_";
      } else if (isMixedLanguage) {
        translationNote = " _(mixed language - already readable)_";
      }
      return `📝 *Transcription*\n\n${finalText}\n\n_Language: ${displayLanguage}${translationNote}_`;
    } catch (error) {
      console.error("Transcription error:", error);

      // Parse error messages
      if (error.message.includes("faster_whisper")) {
        return "❌ *Whisper not installed!*\n\nRun this command on your server:\n```bash\npip install faster-whisper\n```\n\nOr check the WHISPER_SETUP.md guide!";
      } else if (
        error.message.includes("GROQ") ||
        error.message.includes("transcribe")
      ) {
        return "❌ *Transcription failed!*\n\nCheck GROQ_API_KEY in .env file. Get free key at: console.groq.com/keys";
      }

      return `❌ Transcription failed: ${error.message}\n\nTry again or contact bot owner if this persists!`;
    }
  }

  getTranscribeHelpMessage() {
    return `🎙️ *Voice Transcription Help*

*Basic Usage:*
Reply to a voice message with:
• \`-transcribe [lang]\` or \`-tb [lang]\`

*Default Behavior:*
• \`-tb\` → Transcribes to English (auto-translates if needed)

*Language Preservation:*
• \`-tb hi\` → Keep Hindi transcription
• \`-tb es\` → Keep Spanish transcription
• \`-tb fr\` → Keep French transcription

*Supported Languages (29+):*

🌍 *European Languages:*
• \`en\` 🇺🇸 English • \`es\` 🇪🇸 Spanish • \`fr\` 🇫🇷 French
• \`de\` 🇩🇪 German • \`it\` 🇮🇹 Italian • \`pt\` 🇧🇷 Portuguese
• \`ru\` 🇷🇺 Russian • \`pl\` 🇵🇱 Polish • \`nl\` 🇳🇱 Dutch
• \`sv\` 🇸🇪 Swedish • \`da\` 🇩🇰 Danish • \`fi\` 🇫🇮 Finnish
• \`no\` 🇳🇴 Norwegian • \`cs\` 🇨🇿 Czech • \`el\` 🇬🇷 Greek
• \`hu\` 🇭🇺 Hungarian • \`ro\` 🇷🇴 Romanian • \`uk\` 🇺🇦 Ukrainian
• \`tr\` 🇹🇷 Turkish

🌏 *Asian Languages:*
• \`hi\` 🇮🇳 Hindi • \`ja\` 🇯🇵 Japanese • \`ko\` 🇰🇷 Korean
• \`zh\` 🇨🇳 Chinese • \`ar\` 🇸🇦 Arabic • \`id\` 🇮🇩 Indonesian
• \`ms\` 🇲🇾 Malay • \`th\` 🇹🇭 Thai • \`vi\` 🇻🇳 Vietnamese

*Examples:*
1️⃣ Reply to Hindi voice + \`-tb\` → Get English text
2️⃣ Reply to Hindi voice + \`-tb hi\` → Get Hindi text
3️⃣ Reply to French voice + \`-tb fr\` → Get French text
4️⃣ Reply to Spanish voice + \`-tb\` → Get English text

*Features:*
✅ 100% FREE & Unlimited
✅ Powered by Local Whisper
✅ Auto language detection
✅ Supports 29+ languages
✅ Auto-translates to English by default

*Note:* Without language code, all transcriptions are translated to English for convenience!`;
  }

  async dubVoiceMessage(args, message) {
    try {
      const { senderName = "User", senderJid = "" } = this.currentContext;

      // Check for help command
      if (args[0]?.toLowerCase() === "help") {
        return this.getDubHelpMessage();
      }

      // Parse language argument (default to English)
      const targetLang = args[0]?.toLowerCase() || "en";

      // Validate language
      const language = DubService.validateLanguage(targetLang);
      if (!language) {
        return `❌ Unsupported language code: *${targetLang}*\n\n💡 Use *-dub help* to see all available languages and examples!`;
      }

      // Check if replying to a voice message
      if (!message.hasQuotedMsg) {
        return `🎙️ *Voice Message Dubbing*\n\nReply to a voice message with:\n-dub [language]\n\nExamples:\n• -dub → English (default)\n• -dub hi → Hindi 🇮🇳\n• -dub fr → French 🇫🇷\n• -dub es → Spanish 🇪🇸\n\n💡 Use *-dub help* for all languages!`;
      }

      // Get the actual Baileys message structure to check for audio
      const contextInfo =
        message.raw?.message?.extendedTextMessage?.contextInfo;
      const quotedMessage = contextInfo?.quotedMessage;

      // Check if quoted message is audio/voice (PTT or regular audio)
      const hasAudio = quotedMessage?.audioMessage || quotedMessage?.pttMessage;

      if (!hasAudio) {
        return "❌ Please reply to a *voice message* or audio file!";
      }

      const quotedMsg = await message.getQuotedMessage();

      // React with country flag
      try {
        await message.react(language.flag);
      } catch (e) {
        console.warn("Failed to react with flag:", e.message);
      }

      // Download the audio from quoted message
      // Create a proper Baileys message object for download
      const quotedMsgObj = {
        key: {
          remoteJid: message.from,
          fromMe: contextInfo.participant === message.raw.key.remoteJid,
          id: contextInfo.stanzaId,
        },
        message: quotedMessage,
      };

      const { downloadMediaMessage } = require("@whiskeysockets/baileys");
      console.log("📥 Downloading voice message...");
      const audioBuffer = await downloadMediaMessage(
        quotedMsgObj,
        "buffer",
        {},
      );

      if (!audioBuffer) {
        return "❌ Failed to download voice message. Try again!";
      }

      console.log(`✅ Downloaded ${(audioBuffer.length / 1024).toFixed(2)} KB`);

      // Process dubbing (this will take a while)
      const result = await DubService.dubVoiceMessage(audioBuffer, targetLang);

      // Read the dubbed audio file
      const fs = require("fs");
      const dubbedAudio = fs.readFileSync(result.filepath);

      // Clean up audio file after a delay
      setTimeout(() => {
        result.cleanup();
      }, 5000);

      // Determine TTS engine branding
      const ttsEngine = process.env.DUB_TTS_ENGINE || "piper";
      const engineBranding =
        ttsEngine === "elevenlabs"
          ? "Powered by ElevenLabs (AI Dubbing with Voice Cloning)\n_Note: Free tier includes audio watermark_"
          : "Powered by Piper TTS (Free & Unlimited)";

      // Success! Return dubbed audio
      return {
        text: `✅ *Dubbed to ${language.name}!*\n\n*${engineBranding}*`,
        media: {
          audio: dubbedAudio,
          mimetype:
            ttsEngine === "elevenlabs"
              ? "audio/mpeg"
              : "audio/ogg; codecs=opus",
          ptt: true, // Send as voice note
        },
      };
    } catch (error) {
      console.error("Dubbing error:", error);

      // Parse error messages
      if (error.message.includes("Piper model not found")) {
        return "❌ *Piper models not installed!*\n\nRun this command on your server:\n```bash\n./setup-piper.sh\n```\n\nThis will download the voice models (~500MB). Contact bot owner if issue persists!";
      } else if (
        error.message.includes("GROQ") ||
        error.message.includes("transcribe")
      ) {
        return "❌ *Transcription failed!*\n\nCheck GROQ_API_KEY in .env file. Get free key at: console.groq.com/keys";
      } else if (error.message.includes("translate")) {
        return "❌ *Translation failed!*\n\nGoogle Translate API error. Try again in a moment!";
      } else if (error.message.includes("Unsupported")) {
        return `❌ ${error.message}`;
      } else if (error.message.includes("already in")) {
        return error.message;
      }

      return `❌ Dubbing failed: ${error.message}\n\nTry again or contact bot owner if this persists!`;
    }
  }

  async getMessageSenderName(message) {
    try {
      if (message.fromMe) {
        return "You";
      }

      const contact = await message.getContact();
      return contact.pushname || contact.name || "Unknown";
    } catch (error) {
      return "Unknown";
    }
  }

  async showStatus(args, message) {
    try {
      // Get bot instance from global (we'll set this up)
      const bot = global.edenBot;

      if (!bot) {
        return "📊 *Eden Status*\n\n✅ Bot is active and responding!\n🤖 All systems operational";
      }

      const uptime = Date.now() - bot.startTime;
      const hours = Math.floor(uptime / 3600000);
      const minutes = Math.floor((uptime % 3600000) / 60000);
      const seconds = Math.floor((uptime % 60000) / 1000);

      let status = "📊 *EDEN BOT STATUS*\n\n";
      status += "✅ *Status:* Active and Ready\n";
      status += `⏰ *Uptime:* ${hours}h ${minutes}m ${seconds}s\n`;
      status += `📨 *Messages Received:* ${bot.messageCount}\n`;
      status += `🎯 *Commands Executed:* ${bot.commandCount}\n`;
      status += `😈 *Current Mood:* ${bot.currentMood}\n`;
      status += `🧠 *LLM Provider:* ${
        process.env.GROQ_API_KEY ? "Groq (Free)" : "Fallback"
      }\n`;
      status += `💬 *Command Prefix:* -\n`;
      status += `🎭 *Features:*\n`;
      status += `   • Name Triggers: ${bot.triggerNames.join(", ")}\n`;
      status += `   • Mood System: ${
        bot.enableMoodSystem ? "Active" : "Disabled"
      }\n`;
      status += `   • Random Messages: ${
        bot.enableRandomMessages ? "Active" : "Disabled"
      }\n`;
      status += `   • Smart Context: ${
        bot.enableSmartContext ? "Active" : "Disabled"
      }\n`;
      status += `\n💡 *Tip:* Use \`-help\` to see all commands`;

      return status;
    } catch (error) {
      return "✅ Bot is active and responding to commands!";
    }
  }

  async ping(args, message) {
    const responses = [
      "🏓 Pong! I'm alive and ready to be mean!",
      "✅ Yep, still here... unfortunately for you.",
      "🤖 Online and fully operational! Ready to roast!",
      "💚 I'm here! Did you miss my sarcasm?",
      "⚡ Fast as lightning and twice as shocking!",
      "🎯 Bulls eye! Direct hit! I'm active!",
      "😈 Present and accounted for! What do you want?",
      "🔥 Alive, active, and ready to burn!",
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  async systemInfo(args, message) {
    const os = require("os");

    // System details
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const osType = os.type();

    // Memory
    const totalMemGB = (os.totalmem() / 1024 ** 3).toFixed(2);
    const freeMemGB = (os.freemem() / 1024 ** 3).toFixed(2);
    const usedMemGB = (totalMemGB - freeMemGB).toFixed(2);
    const memPercent = ((usedMemGB / totalMemGB) * 100).toFixed(1);

    // CPU
    const cpus = os.cpus();
    const cpuModel = cpus[0].model.trim();
    const cpuCores = cpus.length;

    // Uptime
    const uptimeSeconds = os.uptime();
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptimeMins = Math.floor((uptimeSeconds % 3600) / 60);

    // Process info
    const nodeVersion = process.version;
    const processUptime = Math.floor(process.uptime() / 60);
    const processMem = (process.memoryUsage().heapUsed / 1024 ** 2).toFixed(2);

    // Detect if Raspberry Pi
    const isRaspberryPi =
      cpuModel.toLowerCase().includes("arm") ||
      (platform === "linux" && arch.includes("arm"));

    // Self-deprecating intros for Pi, savage for others
    const intros = isRaspberryPi
      ? [
          "Yeah yeah, I'm running on a Raspberry Pi. Don't judge me. 🍓",
          "Look, I know I'm on a tiny computer. Still smarter than you though. 🤷",
          "Running on a Pi and STILL more capable than you. Sad. 😏",
          "My hardware is literally the size of a credit card. Your excuses? �",
          "Yes, this is a Raspberry Pi. No, I'm not impressed by your gaming PC. 🙄",
          "Potato PC? More like I'm running on an actual fruit and still winning. 🍓",
        ]
      : [
          "Oh, you wanna know what's running this masterpiece? Fine. 🙄",
          "Curious about my specs? Here's what I'm working with:",
          "Let me show you what I'm running on... 💻",
          "Checking my guts? Alright, here you go:",
        ];

    const intro = intros[Math.floor(Math.random() * intros.length)];

    // Memory status emoji
    const memEmoji = memPercent > 80 ? "🔴" : memPercent > 60 ? "🟡" : "🟢";

    // Savage ending based on hardware
    const endings = isRaspberryPi
      ? [
          "*Look, I might be smol but I'm mighty. Don't @ me.* 💪",
          "*Tiny hardware, MASSIVE attitude. Deal with it.* 😤",
          "*Yeah I'm pocket-sized. Your brain is too.* 🧠",
          "*Small but deadly. Like a chihuahua. 🐕*",
        ]
      : [
          "*Satisfied? Now go touch grass.* 🌱",
          "*There you go. Happy now?* 🙄",
          "*Impressed? You should be.* 💅",
        ];

    const ending = endings[Math.floor(Math.random() * endings.length)];

    return `${intro}

🖥️ *SYSTEM INFO*
━━━━━━━━━━━━━━━━━━━━

📱 *Device:* ${hostname}
💻 *OS:* ${osType} ${platform}
🔧 *Architecture:* ${arch}

⚙️ *CPU:* 
└─ ${cpuModel}
└─ ${cpuCores} core${cpuCores > 1 ? "s" : ""}

💾 *Memory:*
└─ Total: ${totalMemGB} GB
└─ Used: ${usedMemGB} GB (${memPercent}%) ${memEmoji}
└─ Free: ${freeMemGB} GB
└─ Bot: ${processMem} MB

⏱️ *Uptime:*
└─ System: ${uptimeDays}d ${uptimeHours}h ${uptimeMins}m
└─ Bot: ${processUptime} min

🟢 *Runtime:* Node.js ${nodeVersion}

━━━━━━━━━━━━━━━━━━━━
${ending}`;
  }

  async playMusic(args, message) {
    try {
      const query = args.join(" ");
      const normalizedQuery = query.trim().toLowerCase();

      if (
        normalizedQuery === "lysa" ||
        normalizedQuery === "sarah" ||
        normalizedQuery === "scott" ||
        normalizedQuery === "yousef"
      ) {
        const fs = require("fs");
        const path = require("path");
        const voiceFolder = normalizedQuery;
        const voiceDir = path.join(__dirname, "..", voiceFolder);
        const voiceFiles = fs
          .readdirSync(voiceDir)
          .filter((fileName) => /\.(m4a|mp3|ogg|opus|wav)$/i.test(fileName));

        if (voiceFiles.length === 0) {
          throw new Error(`No voice note found in the ${voiceFolder} folder`);
        }

        const lastVoiceClip = this.lastVoiceClipByFolder[voiceFolder];
        const candidateFiles =
          voiceFiles.length > 1
            ? voiceFiles.filter((fileName) => fileName !== lastVoiceClip)
            : voiceFiles;

        const randomIndex = Math.floor(Math.random() * candidateFiles.length);
        const selectedFile = candidateFiles[randomIndex];
        this.lastVoiceClipByFolder[voiceFolder] = selectedFile;

        const voiceNotePath = path.join(voiceDir, selectedFile);
        const voiceNoteData = fs.readFileSync(voiceNotePath);

        return {
          media: {
            audio: voiceNoteData,
            mimetype: voiceNotePath.toLowerCase().endsWith(".m4a")
              ? "audio/mp4"
              : "audio/mpeg",
            ptt: true,
          },
        };
      }

      if (!query || query.trim().length === 0) {
        const { isNiceUser = false } = this.currentContext;
        return isNiceUser
          ? "What song should I download? 😊\n\nUsage: `-play Tera hone laga hoon`"
          : "What am I supposed to download? Air? Give me a song name, genius. 🙄\n\nUsage: `-play Tera hone laga hoon`";
      }

      const { senderName = "User", isNiceUser = false } = this.currentContext;

      // Send initial response for music search.
      const searchMsg = isNiceUser
        ? `🔍 Searching for "${query}"...`
        : `🔍 Fine, searching for "${query}"... This better be worth my time.`;
      await message.reply(searchMsg);

      // Search and download
      const result = await this.youtubeService.searchAndDownload(query);

      // Prepare media with Baileys
      const fs = require("fs");
      const audioData = fs.readFileSync(result.filepath);
      const sassyQuote = this.youtubeService.getRandomYouTubeQuote(isNiceUser);

      // Send thumbnail if available
      console.log("📸 Thumbnail check:", {
        hasThumbnail: !!result.thumbnail,
        hasFilepath: result.thumbnail?.filepath,
      });

      if (result.thumbnail && result.thumbnail.filepath) {
        try {
          console.log("📸 Reading thumbnail from:", result.thumbnail.filepath);
          const thumbnailData = fs.readFileSync(result.thumbnail.filepath);
          console.log("📸 Thumbnail size:", thumbnailData.length, "bytes");

          // Send thumbnail with caption using Baileys
          console.log("📸 Sending thumbnail...");
          await message.reply({
            image: thumbnailData,
            caption: `🎵 *${result.title}*\n\n${sassyQuote}`,
          });
          console.log("✅ Thumbnail sent successfully");

          // Clean up thumbnail after a delay
          setTimeout(() => {
            result.thumbnail.cleanup();
          }, 3000);
        } catch (thumbError) {
          console.error("Error sending thumbnail:", thumbError);
          // Send text without thumbnail if thumbnail fails
          await message.reply(`🎵 *${result.title}*\n\n${sassyQuote}`);
        }
      } else {
        // No thumbnail available, send text only
        await message.reply(`🎵 *${result.title}*\n\n${sassyQuote}`);
      }

      // Clean up audio file after a delay
      setTimeout(() => {
        result.cleanup();
      }, 5000);

      // Return the audio media (caption/text already sent above)
      return {
        media: {
          audio: audioData,
          mimetype: "audio/mpeg",
        },
      };
    } catch (error) {
      console.error("Play music error:", error);
      const { isNiceUser = false } = this.currentContext;
      const errorMessage = error?.message || "";

      if (errorMessage.includes("yt-dlp not installed")) {
        return isNiceUser
          ? "I need yt-dlp to download music! 😊\n\nInstall it:\n• Mac: `brew install yt-dlp`\n• Linux: `pip install yt-dlp`\n• Or check: https://github.com/yt-dlp/yt-dlp"
          : "Ugh, I can't download music without yt-dlp installed. 🙄\n\nInstall it first:\n• Mac: `brew install yt-dlp`\n• Linux: `pip install yt-dlp`\n• Or check: https://github.com/yt-dlp/yt-dlp";
      }

      if (
        errorMessage.includes("HTTP Error 403") ||
        errorMessage.includes("Forbidden") ||
        errorMessage.includes("unable to download video data")
      ) {
        return isNiceUser
          ? "YouTube blocked this download (403). Please update yt-dlp and try again. 😊\n\nRun: `python3 -m pip install -U yt-dlp`"
          : "YouTube blocked the download with a 403. Update yt-dlp and try again. 🙄\n\nRun: `python3 -m pip install -U yt-dlp`";
      }

      if (
        errorMessage.includes("ffmpeg not found") ||
        errorMessage.includes("ffprobe")
      ) {
        return isNiceUser
          ? "I need ffmpeg to convert videos! 😊\n\n*Install ffmpeg:*\n• Mac: `brew install ffmpeg`\n• Linux: `sudo apt install ffmpeg`\n\nThen try again!"
          : "I need ffmpeg to convert videos to MP3, genius. 🙄\n\n*Install ffmpeg:*\n• Mac: `brew install ffmpeg`\n• Linux: `sudo apt install ffmpeg`\n\nThen try again.";
      }

      if (errorMessage.includes("Could not find video")) {
        return isNiceUser
          ? `Couldn't find "${args.join(
              " ",
            )}" on YouTube. Try a different search? 😊`
          : `Couldn't find "${args.join(
              " ",
            )}" on YouTube. Maybe try spelling it correctly? 🤔`;
      }

      if (isNiceUser) {
        const errorResponses = [
          "Download failed! Want to try again? 😊",
          "Something went wrong. Try once more?",
          "Error downloading. Let's try another song? 🎵",
          "Oops! Download failed. Try again?",
        ];
        return errorResponses[
          Math.floor(Math.random() * errorResponses.length)
        ];
      }

      const errorResponses = [
        "Well that didn't work. YouTube's probably judging your music taste too. 🙄",
        "Download failed. Even the internet doesn't want you to have this song. 💀",
        "Something went wrong. Maybe pick a song that actually exists? 🤷‍♀️",
        "Error downloading. Try again or get better taste in music. 😒",
      ];

      return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    }
  }

  async downloadYouTubeVideo(args, message) {
    // Extract URL outside try block so it's available in catch
    const url = args.join(" ").trim();

    try {
      if (!url || url.length === 0) {
        const { isNiceUser = false } = this.currentContext;
        return isNiceUser
          ? "Please provide a YouTube URL! 😊\n\nUsage: `-yt https://youtube.com/watch?v=...`"
          : "Give me a YouTube URL, genius. 🙄\n\nUsage: `-yt https://youtube.com/watch?v=...`";
      }

      // Validate YouTube URL
      const youtubeRegex =
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
      if (!youtubeRegex.test(url)) {
        const { isNiceUser = false } = this.currentContext;
        return isNiceUser
          ? "That doesn't look like a YouTube URL! 🤔\n\nPlease provide a valid YouTube link."
          : "That's not a YouTube URL, dummy. 🙄\n\nTry something like: https://youtube.com/watch?v=...";
      }

      const { senderName = "User", isNiceUser = false } = this.currentContext;

      const videoTitle = await this.youtubeService.getVideoTitle(url);
      const shortTitle = (videoTitle || "Video")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 80);
      const downloadingMsg = isNiceUser
        ? `🎬 Downloading ${shortTitle}...`
        : `🎬 Downloading ${shortTitle}... happy now?`;
      await message.reply(downloadingMsg);

      // Download the video without interim chat progress updates.
      const result = await this.youtubeService.downloadVideo(url);
      if (videoTitle) {
        result.title = videoTitle;
      }

      // Read video file
      const fs = require("fs");
      const videoData = fs.readFileSync(result.filepath);

      // Check file size (WhatsApp has limits)
      const maxSizeMB = 64; // WhatsApp video limit
      if (result.size > maxSizeMB) {
        result.cleanup();
        return isNiceUser
          ? `⚠️ The video is too large (${result.size}MB)! WhatsApp only supports videos up to ${maxSizeMB}MB.\n\nTry a shorter video!`
          : `🙄 The video is ${result.size}MB! WhatsApp maxes out at ${maxSizeMB}MB.\n\nMaybe try something that's not a feature film?`;
      }

      const sassyQuote = isNiceUser
        ? `✅ Here's your video! Enjoy! 🎬`
        : `🎬 Here. Now stop making me your personal YouTube downloader. 💀`;

      // Send caption with thumbnail if available
      if (result.thumbnail && result.thumbnail.filepath) {
        try {
          const thumbnailData = fs.readFileSync(result.thumbnail.filepath);

          await message.reply({
            image: thumbnailData,
            caption: `🎬 *${result.title}*\n\n💾 Size: ${result.size}MB\n\n${sassyQuote}`,
          });

          setTimeout(() => {
            result.thumbnail.cleanup();
          }, 3000);
        } catch (thumbError) {
          console.error("Error sending thumbnail:", thumbError);
          await message.reply(
            `🎬 *${result.title}*\n\n💾 Size: ${result.size}MB\n\n${sassyQuote}`,
          );
        }
      } else {
        await message.reply(
          `🎬 *${result.title}*\n\n💾 Size: ${result.size}MB\n\n${sassyQuote}`,
        );
      }

      // Clean up video file after a delay
      setTimeout(() => {
        result.cleanup();
      }, 10000);

      // Return the video media
      return {
        media: {
          video: videoData,
          mimetype: "video/mp4",
          caption: `🎬 ${result.title}`,
        },
      };
    } catch (error) {
      console.error("YouTube video download error:", error);

      // Get isNiceUser from context for error messages
      const { isNiceUser = false } = this.currentContext;

      if (error.message.includes("yt-dlp not installed")) {
        return isNiceUser
          ? "I need yt-dlp to download videos! 😊\n\nInstall it:\n• Mac: `brew install yt-dlp`\n• Linux: `pip install yt-dlp`\n• Or check: https://github.com/yt-dlp/yt-dlp"
          : "Ugh, I can't download videos without yt-dlp installed. 🙄\n\nInstall it first:\n• Mac: `brew install yt-dlp`\n• Linux: `pip install yt-dlp`\n• Or check: https://github.com/yt-dlp/yt-dlp";
      }

      if (
        error.message.includes("ffmpeg not found") ||
        error.message.includes("ffprobe")
      ) {
        return isNiceUser
          ? "I need ffmpeg to process videos! 😊\n\n*Install ffmpeg:*\n• Mac: `brew install ffmpeg`\n• Linux: `sudo apt install ffmpeg`\n\nThen try again!"
          : "I need ffmpeg to process videos, genius. 🙄\n\n*Install ffmpeg:*\n• Mac: `brew install ffmpeg`\n• Linux: `sudo apt install ffmpeg`\n\nThen try again.";
      }

      if (
        error.message.includes("Video unavailable") ||
        error.message.includes("Private video") ||
        error.message.includes("ERROR: [youtube]") ||
        error.message.includes("Download failed") ||
        (error.stderr && error.stderr.includes("Video unavailable"))
      ) {
        const vid = url.includes("youtu.be/")
          ? url.split("youtu.be/")[1]?.split(/[\?&]/)[0]
          : url.includes("v=")
            ? url.split("v=")[1]?.split(/[\?&]/)[0]
            : url.includes("/shorts/")
              ? url.split("/shorts/")[1]?.split(/[\?&]/)[0]
              : null;

        return isNiceUser
          ? `⚠️ YouTube is blocking the download! Here's what to do:\n\n✅ *Fix This:*\n1️⃣ Update yt-dlp (REQUIRED):\n   \`pip3 install -U yt-dlp\`\n   or\n   \`sudo pip3 install -U yt-dlp\`\n\n2️⃣ If still failing, try:\n   \`yt-dlp -U\`\n\n3️⃣ Then retry: \`-yt ${url}\`\n\n💡 YouTube often blocks old yt-dlp versions!\nThe video is available, just need the latest version. 😊`
          : `🙄 YouTube is blocking this. NOT your fault for once.\n\n*Fix it:*\n1️⃣ Update yt-dlp NOW:\n   \`pip3 install -U yt-dlp\`\n   or if that fails:\n   \`sudo pip3 install -U yt-dlp\`\n   or:\n   \`yt-dlp -U\`\n\n2️⃣ Retry: \`-yt ${url}\`\n\n💀 YouTube breaks yt-dlp regularly.\nUpdate = fix. Simple.\n\n${vid ? `Video ID: ${vid}` : ""}`;
      }

      if (isNiceUser) {
        const errorResponses = [
          "Download failed! Want to try again? 😊",
          "Something went wrong. Try once more?",
          "Error downloading. Let's try a different video? 🎬",
          "Oops! Download failed. Try again?",
        ];
        return errorResponses[
          Math.floor(Math.random() * errorResponses.length)
        ];
      }

      const errorResponses = [
        "Well that didn't work. Try again or pick a better video. 🙄",
        "Download failed. Even YouTube is against you today. 💀",
        "Something went wrong. Maybe the video is cursed? 🤷‍♀️",
        "Error downloading. Try again or give up. 😒",
      ];

      return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    }
  }

  async handleInteraction(args, message) {
    try {
      const { senderName = "User" } = this.currentContext;
      const axios = require("axios");

      // Get command name (hug, kiss, etc.) - remove the 's' if present (hugs -> hug)
      const cmd = this.currentContext.originalCommand || "hug";
      const interaction =
        cmd.endsWith("s") && cmd.length > 4 ? cmd.slice(0, -1) : cmd;

      // Get sender info from message object (using new class structure)
      const senderNumber = message.number || message.userId?.split("@")[0];
      const senderJid = message.userId;
      const sender = `@${senderNumber}`;

      // Get the full message body to extract @ mentions
      const fullMessage = message.body || message.content || "";
      console.log(`📨 Full message:`, fullMessage);

      let target = "themselves";
      let targetJid = null; // Store the JID for mentions array
      const mentionJids = []; // Array to store all JIDs to mention

      // Always add sender to mentions
      if (senderJid) {
        mentionJids.push(senderJid);
      }

      // PRIORITY 1: Check if this is a reply to someone
      if (message.quoted && message.quoted.userId) {
        targetJid = message.quoted.userId;
        const targetNumber = message.quoted.number || targetJid.split("@")[0];
        target = `@${targetNumber}`;
        mentionJids.push(targetJid);

        console.log(`📝 Using quoted message target:`, {
          jid: targetJid,
          number: targetNumber,
          target: target,
        });
      }
      // PRIORITY 2: Try to get mention from getMentions() or message.mentions
      else {
        try {
          let mentions = [];

          // Use new message class structure
          if (message.mentions && message.mentions.length > 0) {
            mentions = await message.getMentions();
          }

          if (mentions && mentions.length > 0) {
            const mention = mentions[0];
            // Store the JID for mentions
            targetJid = mention.jid || mention.id?._serialized;
            const targetNumber = mention.number || targetJid?.split("@")[0];
            target = `@${targetNumber}`;

            // Add target to mentions array
            if (targetJid) {
              mentionJids.push(targetJid);
            }

            console.log(`📝 Using resolved mention:`, {
              jid: targetJid,
              pushname: mention.pushname,
              name: mention.name,
              number: mention.number,
              using: target,
            });
          }
        } catch (error) {
          console.error("Error processing mentions in interaction:", error);
        }

        // PRIORITY 3: If no mention found, try extracting from text
        if (target === "themselves") {
          if (args.length > 0) {
            // Has args - use as target
            target = args.join(" ");
            console.log(`📝 Using args as target:`, { target });
          }
        }
      }

      // Get interaction text with proper mentions (sender and target)
      const interactionText = this.interactionService.getRandomTemplate(
        interaction,
        sender,
        target,
      );

      console.log(
        `💫 ${interaction} interaction: ${sender} -> ${target}`,
        `\n📱 Mentions:`,
        mentionJids,
      );

      // Return text with mentions (GIF removed for now)
      return {
        text: interactionText,
        mentions: mentionJids, // Include all mentions (sender + target)
      };
    } catch (error) {
      console.error("Interaction error:", error);
      const { senderName = "User" } = this.currentContext;
      return `${senderName} tried to do something but failed miserably 🤡`;
    }
  }

  async handlePet(args, message) {
    try {
      const userId = message.userId || message.from;
      const userNumber = (message.number || userId.split("@")[0]).replace(
        /\D/g,
        "",
      );

      // Restrict to only specific users
      const allowedNumbers = ["61259152101540", "207099061624867"];
      console.log(
        `Pet access check - User: ${userNumber}, Allowed: ${allowedNumbers.join(
          ", ",
        )}`,
      );

      if (!allowedNumbers.includes(userNumber)) {
        return `🔒 Sorry, the pet feature is currently in beta and only available to select users!`;
      }

      const [action, ...params] = args;
      const fs = require("fs");
      const path = require("path");

      if (!action) {
        // Show pet status with image
        const display = await this.petService.formatPetDisplay(userId);
        if (!display) {
          return `You don't have a pet yet! 🐉\n\nCreate one with: -pet create <name> <species>\n\nSpecies: dragon, glimmer`;
        }

        // Get pet data to determine which image to show
        const pet = await this.petService.getPet(userId);
        if (pet) {
          // Return with appropriate image based on species
          let imageFilename;
          if (pet.species === "glimmer") {
            imageFilename = "Gemini_Generated_Image_kicv4ekicv4ekicv.png";
          } else if (pet.species === "dragon") {
            imageFilename = "Gemini_Generated_Image_1kosex1kosex1kos.png";
          } else {
            // Fallback to glimmer image for any other species
            imageFilename = "Gemini_Generated_Image_kicv4ekicv4ekicv.png";
          }

          const imagePath = path.join(__dirname, "..", "assets", imageFilename);
          if (fs.existsSync(imagePath)) {
            return {
              media: {
                image: fs.readFileSync(imagePath),
                caption: display,
              },
            };
          }
        }

        return display;
      }

      switch (action.toLowerCase()) {
        case "create": {
          const [name, species = "dragon"] = params;
          if (!name) {
            return `Please provide a name! Usage: -pet create <name> <species>\n\nSpecies: dragon, glimmer`;
          }

          const validSpecies = ["dragon", "glimmer"];
          const selectedSpecies = species.toLowerCase();

          if (!validSpecies.includes(selectedSpecies)) {
            return `Invalid species! Choose from: ${validSpecies.join(", ")}`;
          }

          const existingPet = await this.petService.getPet(userId);
          if (existingPet) {
            return `You already have a pet named ${existingPet.name}! 🐉`;
          }

          await this.petService.createPet(userId, name, selectedSpecies);
          const display = await this.petService.formatPetDisplay(userId);

          // Return with appropriate image based on species
          let imageFilename;
          if (selectedSpecies === "glimmer") {
            imageFilename = "Gemini_Generated_Image_kicv4ekicv4ekicv.png";
          } else if (selectedSpecies === "dragon") {
            imageFilename = "Gemini_Generated_Image_1kosex1kosex1kos.png";
          }

          const imagePath = path.join(__dirname, "..", "assets", imageFilename);
          if (fs.existsSync(imagePath)) {
            return {
              media: {
                image: fs.readFileSync(imagePath),
                caption: `🎉 Congratulations! You created a new pet!\n\n${display}`,
              },
            };
          }

          return `🎉 Congratulations! You created a new pet!\n\n${display}`;
        }

        case "feed": {
          const result = await this.petService.feedPet(userId);
          if (result.error) return result.error;

          let response = result.message;
          if (result.levelUp)
            response += `\n\n🎊 Level Up! Your pet is now level ${
              Math.floor(
                (await this.petService.getPet(userId)).experience / 100,
              ) + 1
            }!`;

          return response;
        }

        case "play": {
          const result = await this.petService.playWithPet(userId);
          if (result.error) return result.error;

          let response = result.message;
          if (result.levelUp)
            response += `\n\n🎊 Level Up! Your pet is now level ${
              Math.floor(
                (await this.petService.getPet(userId)).experience / 100,
              ) + 1
            }!`;

          return response;
        }

        case "train": {
          const result = await this.petService.trainPet(userId);
          if (result.error) return result.error;

          let response = result.message;
          if (result.levelUp)
            response += `\n\n🎊 Level Up! Your pet is now level ${
              Math.floor(
                (await this.petService.getPet(userId)).experience / 100,
              ) + 1
            }!`;
          if (result.giftReady)
            response += `\n\n🎁 A gift is ready! Use -pet gift to claim it!`;

          return response;
        }

        case "gift": {
          const result = await this.petService.claimGift(userId);
          if (result.error) return result.error;
          return result.message;
        }

        case "name": {
          const newName = params.join(" ");
          if (!newName) {
            return `Please provide a new name! Usage: -pet name <new name>`;
          }

          const result = await this.petService.renamePet(userId, newName);
          if (result.error) return result.error;
          return result.message;
        }

        case "traits": {
          const result = await this.petService.addTrait(userId);
          if (result.error) return result.error;
          return result.message;
        }

        case "leaderboard":
        case "top": {
          const leaderboard = await this.petService.getLeaderboard(10);
          if (leaderboard.length === 0) {
            return `No pets yet! Be the first to create one!`;
          }

          let board = `🏆 *Pet Leaderboard* 🏆\n━━━━━━━━━━━━━━━━━━\n\n`;
          leaderboard.forEach((pet, index) => {
            const medal =
              index === 0
                ? "🥇"
                : index === 1
                  ? "🥈"
                  : index === 2
                    ? "🥉"
                    : `${index + 1}.`;
            const speciesEmoji =
              this.petService.species[pet.species]?.emoji || "🐉";
            board += `${medal} ${speciesEmoji} ${pet.name} - Lvl ${pet.level} | Bond ${pet.bond}\n`;
          });

          return board;
        }

        default:
          return `Unknown action! Available actions:\n-pet (view status)\n-pet create <name> <species>\n-pet feed | play | train\n-pet gift | name <new> | traits\n-pet leaderboard`;
      }
    } catch (error) {
      console.error("Pet command error:", error);
      return `Something went wrong with your pet! ${error.message}`;
    }
  }

  async analyzeChatSentiment(args, message) {
    try {
      // Only works in groups
      if (!message.groupId) {
        return `📊 This command only works in group chats!`;
      }

      const messageCount = parseInt(args[0]) || 40;
      const limit = Math.min(Math.max(messageCount, 20), 100); // Between 20-100 messages

      // Send processing message
      await message.reply(
        `🔍 Analyzing last ${limit} messages from WhatsApp history... This may take a moment.`,
      );

      // Get messages from WhatsApp synced message store
      const chatHistory = message.getStoredMessages
        ? message.getStoredMessages(limit)
        : [];

      if (!chatHistory || chatHistory.length === 0) {
        return `❌ No message history available yet. WhatsApp needs to sync messages first.\n\nℹ️ This happens automatically when:\n- Bot just started and history is being synced\n- This is a new group\n\nTry again in a moment or after some messages are sent!`;
      }

      // Format messages for analysis (filter out commands and system messages)
      const formattedMessages = chatHistory
        .filter((msg) => {
          const content = msg.content || "";
          return content.trim().length > 0 && !content.startsWith("-");
        })
        .map((msg) => `${msg.sender}: ${msg.content}`)
        .join("\n");

      if (!formattedMessages) {
        return `❌ No text messages found in the history. Only commands were detected.`;
      }

      // Create prompt for LLM
      const systemPrompt = `You are an expert at analyzing group chat conversations. Provide clear, structured insights with emojis. Be concise and insightful.`;

      const userPrompt = `Analyze this WhatsApp group chat conversation and provide:

1. **Overall Sentiment**: General mood (positive/negative/neutral/mixed)
2. **Key Topics**: Main topics discussed (max 5)
3. **Active Participants**: Most active members and their sentiment
4. **Emotional Tone**: Dominant emotions (joy, anger, excitement, etc.)
5. **Summary**: Brief 2-3 sentence summary

Chat History (${chatHistory.length} messages):
━━━━━━━━━━━━━━━━━━
${formattedMessages}
━━━━━━━━━━━━━━━━━━

Provide a structured analysis with emojis.`;

      // Use the LLM service to generate analysis
      let analysis;
      try {
        if (
          this.llmService.groqApiKey &&
          this.llmService.groqApiKey !== "your_groq_api_key_here"
        ) {
          analysis = await this.llmService.callGroq(userPrompt, systemPrompt);
        } else if (
          this.llmService.openaiApiKey &&
          this.llmService.openaiApiKey !== "your_openai_api_key_here"
        ) {
          analysis = await this.llmService.callOpenAI(userPrompt, systemPrompt);
        } else {
          // Fallback to Ollama
          const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
          analysis = await this.llmService.callOllama(fullPrompt);
        }
      } catch (error) {
        console.error("LLM call error:", error);
        throw new Error("Failed to generate analysis from LLM");
      }

      const response = `📊 *Chat Sentiment Analysis*\n━━━━━━━━━━━━━━━━━━━━\n\n${analysis}\n\n━━━━━━━━━━━━━━━━━━━━\n📈 Analyzed ${chatHistory.length} messages`;

      return response;
    } catch (error) {
      console.error("Sentiment analysis error:", error);
      return `❌ Failed to analyze chat sentiment: ${error.message}`;
    }
  }

  async findInactiveUsers(args, message) {
    try {
      if (!message.groupId) {
        return "📉 This command only works in group chats!";
      }

      if (args.length > 0) {
        return "❌ Usage: `-inactive`\nNo extra arguments needed.";
      }

      const rawMessage = this.currentContext.message;
      if (!rawMessage?.sock) {
        return "❌ Group service unavailable right now. Try again in a moment.";
      }

      const groupMetadata = await rawMessage.sock.groupMetadata(
        message.groupId,
      );
      const participants = groupMetadata?.participants || [];

      // Admin-only command
      const issuerParticipant = participants.find(
        (p) => p.id === rawMessage.userId || p.lid === rawMessage.lid,
      );

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only group admins can use `-inactive`.";
      }

      const historyLimit = 1000000;

      const chatHistory = message.getStoredMessages
        ? message.getStoredMessages(historyLimit)
        : [];

      if (!chatHistory || chatHistory.length === 0) {
        return "❌ No message history available yet. Ask members to chat a bit, then try again.";
      }

      const toContent = (msg) => (msg?.content || msg?.message || "").trim();
      const toSenderJid = (msg) =>
        msg?.sender_jid || msg?.senderJid || msg?.userId || null;
      const isBotMessage = (msg) => msg?.is_bot === 1 || msg?.isBot === true;
      const normalizeNumber = (jid = "") =>
        String(jid || "")
          .split("@")[0]
          .replace(/[^0-9]/g, "");

      const countsByJid = new Map();
      const countsByNumber = new Map();

      for (const msg of chatHistory) {
        if (isBotMessage(msg)) continue;

        const senderJid = toSenderJid(msg);
        const content = toContent(msg);
        if (!senderJid || !content) continue;

        countsByJid.set(senderJid, (countsByJid.get(senderJid) || 0) + 1);

        const senderNumber = normalizeNumber(senderJid);
        if (senderNumber) {
          countsByNumber.set(
            senderNumber,
            (countsByNumber.get(senderNumber) || 0) + 1,
          );
        }
      }

      const botJid = rawMessage.sock.user?.id;
      const botLid = rawMessage.sock.user?.lid;
      const botNumber = normalizeNumber(botJid || "");
      const botLidNumber = normalizeNumber(botLid || "");

      const getParticipantNumbers = (participant) => {
        const rawCandidates = [
          participant?.id,
          participant?.jid,
          participant?.lid,
          participant?.phoneNumber,
        ];

        return [...new Set(rawCandidates.map(normalizeNumber).filter(Boolean))];
      };

      const resultUsers = participants
        .map((participant) => {
          const mentionJid =
            participant.id || participant.jid || participant.lid;
          const mentionNumberRaw =
            participant.phoneNumber?.split("@")[0] ||
            mentionJid?.split("@")[0] ||
            "";
          const mentionNumber =
            normalizeNumber(mentionNumberRaw) || mentionNumberRaw;

          // Merge all known identity variants (id/jid/lid/phoneNumber) to avoid false 0-counts.
          const participantNumbers = getParticipantNumbers(participant);

          const jidCount = [participant.id, participant.jid, participant.lid]
            .filter(Boolean)
            .reduce((sum, jid) => sum + (countsByJid.get(jid) || 0), 0);

          const numberCount = participantNumbers.reduce(
            (sum, number) => sum + (countsByNumber.get(number) || 0),
            0,
          );

          const directCount = Math.max(jidCount, numberCount);

          const displayName =
            participant.notify ||
            participant.name ||
            participant.pushName ||
            null;

          return {
            jid: mentionJid,
            mentionNumber,
            displayName,
            count: directCount,
          };
        })
        .filter((user) => {
          if (!user.jid || !user.mentionNumber) return false;

          // Skip bot itself
          if (
            user.mentionNumber === botNumber ||
            user.mentionNumber === botLidNumber
          ) {
            return false;
          }

          return true;
        })
        .sort((a, b) => {
          if (a.count !== b.count) return a.count - b.count;
          return (a.displayName || a.mentionNumber).localeCompare(
            b.displayName || b.mentionNumber,
          );
        });

      if (resultUsers.length === 0) {
        return "📉 No participants found to evaluate.";
      }

      const lines = resultUsers.map((user, index) => {
        const namePart = user.displayName ? ` (${user.displayName})` : "";
        return `${index + 1}. @${user.mentionNumber}${namePart} — ${user.count} msg`;
      });

      return {
        text:
          `📉 *Inactive Users (Least → Most Active)*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          lines.join("\n") +
          `\n━━━━━━━━━━━━━━━━━━━━\n` +
          `🔢 Sorted low → high`,
        mentions: resultUsers.map((u) => u.jid),
      };
    } catch (error) {
      console.error("Inactive command error:", error);
      return "❌ Failed to generate inactive list. Try again in a moment.";
    }
  }

  /**
   * Fetch and send Pinterest images by search query
   * Usage:
   * -pint Manali
   * -pint 6 Manali
   */
  async sendPinterestImages(args, message) {
    try {
      if (!args.length) {
        return "📌 *Pinterest Image Search*\n\nUsage:\n`-pint [search]`\n`-pint [count] [search]`\n\nExamples:\n`-pint Manali`\n`-pint 6 Manali`\n\nLimits: minimum 4, maximum 10 images.";
      }

      let count = 4;
      let query = args.join(" ").trim();

      const firstArgNumber = parseInt(args[0], 10);
      if (!Number.isNaN(firstArgNumber)) {
        count = firstArgNumber;
        query = args.slice(1).join(" ").trim();
      }

      if (!query) {
        return "❌ Please provide a search query. Example: `-pint Manali`";
      }

      if (count < 4 || count > 10) {
        return "❌ Count must be between 4 and 10. Example: `-pint 6 Manali`";
      }

      await message.reply(
        `📌 Searching for *${query}* (${count} images)...`,
      );

      const axios = require("axios");

      // Helper to normalize URLs
      const normalizeUrl = (rawUrl) => {
        if (!rawUrl) return "";
        return String(rawUrl)
          .replace(/\\u002F/g, "/")
          .replace(/\\\//g, "/")
          .replace(/\\"/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/["'\\]+$/g, "")
          .trim();
      };

      // Pinterest primary attempt
      let images = [];
      try {
        const encodedQuery = encodeURIComponent(query);
        const pinterestUrl = `https://www.pinterest.com/search/pins/?q=${encodedQuery}`;

        const pinterestResponse = await axios.get(pinterestUrl, {
          timeout: 15000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });

        const html = String(pinterestResponse.data || "");

        // Extract pinimg URLs with multiple regex patterns
        const pinimgRegex = /https:\/\/i\.pinimg\.com\/[^\s"'<>{}|\\^`\[\]]+/gi;
        const escapedPinimgRegex =
          /https\\u002F\\u002Fi\.pinimg\.com\\u002F[^\s"'<>{}|\\^`\[\]]+/gi;

        const directMatches = html.match(pinimgRegex) || [];
        const escapedMatches = html.match(escapedPinimgRegex) || [];

        // Also try to extract from JSON data
        const jsonMatches = [];
        const jsonDataRegex =
          /"(https:\/\/i\.pinimg\.com\/[^\s"<>]+)"/gi;
        let match;
        while ((match = jsonDataRegex.exec(html)) !== null) {
          jsonMatches.push(match[1]);
        }

        let candidates = [
          ...new Set([...directMatches, ...escapedMatches, ...jsonMatches]),
        ].map(normalizeUrl);

        // Filter valid Pinterest image URLs
        candidates = candidates.filter(
          (url) =>
            url.startsWith("https://i.pinimg.com/") &&
            !/\.(ico|svg)($|\?)/i.test(url) &&
            !url.includes("blank.gif")
        );

        // Prioritize by file type (jpg/jpeg > webp > png > gif)
        const priority = (url) => {
          if (/\.jpg($|\?|&)/i.test(url)) return 0;
          if (/\.jpeg($|\?|&)/i.test(url)) return 1;
          if (/\.webp($|\?|&)/i.test(url)) return 2;
          if (/\.png($|\?|&)/i.test(url)) return 3;
          if (/\.gif($|\?|&)/i.test(url)) return 4;
          return 5;
        };

        images = candidates.sort((a, b) => priority(a) - priority(b));
      } catch (pinterestError) {
        console.log("Pinterest primary attempt failed:", pinterestError.message);
      }

      // Fallback: Bing Images
      if (images.length < count) {
        try {
          const bingQuery = encodeURIComponent(query);
          const bingUrl = `https://www.bing.com/images/search?q=${bingQuery}`;

          const bingResponse = await axios.get(bingUrl, {
            timeout: 15000,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });

          const bingHtml = String(bingResponse.data || "");

          // Extract image URLs from Bing
          const bingPinimgRegex =
            /https:\/\/i\.pinimg\.com\/[^\s"'<>{}|\\^`\[\]]+/gi;
          const bingDirect = bingHtml.match(bingPinimgRegex) || [];

          let newCandidates = bingDirect.map(normalizeUrl).filter(
            (url) =>
              url.startsWith("https://i.pinimg.com/") &&
              !/\.(ico|svg)($|\?)/i.test(url)
          );

          images = [...new Set([...images, ...newCandidates])];
        } catch (bingError) {
          console.log("Bing fallback failed:", bingError.message);
        }
      }

      // Final fallback: Generic image URLs from web
      if (images.length < count) {
        try {
          const webQuery = encodeURIComponent(query);
          const webUrl = `https://pixabay.com/api/?key=dummy&q=${webQuery}&per_page=${count}&image_type=photo`;

          const webResponse = await axios.get(webUrl, {
            timeout: 10000,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });

          const data = webResponse.data;
          if (data.hits && Array.isArray(data.hits)) {
            const webImages = data.hits
              .map((hit) => hit.webformatURL || hit.imageURL)
              .filter(Boolean)
              .slice(0, count);

            images = [...new Set([...images, ...webImages])];
          }
        } catch (webError) {
          console.log("Web fallback failed:", webError.message);
        }
      }

      // Check if we got enough images
      if (images.length < 4) {
        return `❌ Couldn't find enough images for *${query}*. Try another keyword!`;
      }

      // Slice to requested count
      images = images.slice(0, count);

      // Format response
      const mediaList = images.map((url, index) => ({
        image: { url },
        caption:
          index === 0
            ? `📌 *Image Search*\n🔎 Query: ${query}\n🖼️ Found ${images.length} images`
            : undefined,
      }));

      return {
        mediaList,
      };
    } catch (error) {
      console.error("❌ Image search error:", error.message);
      return "❌ Failed to fetch images. Try again in a moment!";
    }
  }

  /**
   * Generate image from text prompt (Text-to-Image)
   */
  async generateImage(args, message) {
    try {
      const { senderName = "User" } = this.currentContext;

      // Check for help
      if (args[0]?.toLowerCase() === "help") {
        return ImageService.getHelpMessage();
      }

      // Get prompt
      let prompt = args.join(" ").trim();
      if (!prompt) {
        return `🎨 *AI Image Generation*\n\nUsage: \`-imagine [prompt]\`\n\nExample:\n\`-imagine a beautiful sunset over mountains\`\n\n💡 Use \`-imagine help\` for more info!`;
      }

      // Extract provider if specified (e.g., [provider:gemini])
      let provider = "pollinations"; // Default to Pollinations (100% free, no key)
      const providerMatch = prompt.match(/\[provider:(\w+)\]/i);
      if (providerMatch) {
        provider = providerMatch[1].toLowerCase();
        prompt = prompt.replace(providerMatch[0], "").trim();
      }

      // Extract model if specified (e.g., [model:turbo])
      let model = "flux";
      const modelMatch = prompt.match(/\[model:(\w+(-\w+)?)\]/i);
      if (modelMatch) {
        model = modelMatch[1].toLowerCase();
        prompt = prompt.replace(modelMatch[0], "").trim();
      }

      console.log(
        `🎨 ${senderName} requested image: "${prompt.substring(0, 60)}..." (Provider: ${provider}, Model: ${model})`,
      );

      // Generate random sassy response
      const responses = ImageService.getImageResponses();
      const sassyResponse =
        responses[Math.floor(Math.random() * responses.length)];

      // Send initial reaction
      await message.reply(sassyResponse);

      // Try primary provider first, fallback to Pollinations if it fails
      let result;
      try {
        result = await ImageService.textToImage(prompt, {
          model,
          enhance: true,
          width: 1024,
          height: 1024,
          provider, // Pass provider option
        });
      } catch (error) {
        // If Gemini fails, fallback to Pollinations
        if (provider === "gemini") {
          console.log("⚠️ Gemini failed, falling back to Pollinations...");
          await message.reply(
            "⚠️ Gemini failed, using Pollinations instead...",
          );
          result = await ImageService.textToImage(prompt, {
            model,
            enhance: true,
            width: 1024,
            height: 1024,
            provider: "pollinations",
          });
        } else {
          throw error;
        }
      }

      // Read the image file
      const fs = require("fs");
      const imageBuffer = fs.readFileSync(result.filepath);

      // Clean up after a delay
      setTimeout(() => {
        result.cleanup();
      }, 5000);

      // Return image with caption
      return {
        media: {
          image: imageBuffer,
          caption: `✨ *Generated Image*\n\n📝 Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}\n🎨 Model: ${model}\n\n*Powered by Pollinations AI*`,
        },
      };
    } catch (error) {
      console.error("❌ Image generation error:", error);

      // Check if it's NSFW content
      if (error.message === "NSFW_CONTENT") {
        const rejections = ImageService.getNSFWRejectionResponses();
        return rejections[Math.floor(Math.random() * rejections.length)];
      }

      // General error
      const errorResponses = ImageService.getImageErrorResponses();
      return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    }
  }

  /**
   * Transform image based on prompt (Image-to-Image)
   */
  async transformImage(args, message) {
    try {
      const { senderName = "User" } = this.currentContext;

      // Check for help
      if (args[0]?.toLowerCase() === "help") {
        return `🔄 *Image Transformation*\n\n*Method 1 - Reply to image:*\nReply to an image with:\n\`-transform [prompt]\`\n\n*Method 2 - Send image with command:*\nSend an image with caption:\n\`-transform [prompt]\`\n\nExample:\nReply to a photo: \`-transform make it look like an oil painting\`\nOr send image with: \`-transform anime style\`\n\n💡 The image will be transformed based on your prompt!`;
      }

      let imageMedia = null;
      let prompt = args.join(" ").trim();

      // Method 1: Check if message itself has image (sent with caption)
      if (message.hasMedia) {
        console.log(`📸 Image sent with command caption`);
        imageMedia = await message.downloadMedia();
      }
      // Method 2: Check if replying to a message with image
      else if (message.hasQuotedMsg) {
        const quotedMsg = await message.getQuotedMessage();
        if (quotedMsg && quotedMsg.hasMedia) {
          console.log(`📸 Replying to image`);
          imageMedia = await quotedMsg.downloadMedia();
        }
      }

      // No image found
      if (!imageMedia) {
        return `🔄 *Image Transformation*\n\nPlease either:\n1️⃣ Reply to an image with: \`-transform [prompt]\`\n2️⃣ Send an image with caption: \`-transform [prompt]\`\n\nExample: \`-transform make it anime style\``;
      }

      // Check for prompt
      if (!prompt) {
        return `❌ Please provide a transformation prompt!\n\nExample: \`-transform make it look like a watercolor painting\``;
      }

      // Extract model if specified
      let model = "flux";
      let finalPrompt = prompt;
      const modelMatch = prompt.match(/\[model:(\w+(-\w+)?)\]/i);
      if (modelMatch) {
        model = modelMatch[1].toLowerCase();
        finalPrompt = prompt.replace(modelMatch[0], "").trim();
      }

      console.log(
        `🔄 ${senderName} transforming image: "${finalPrompt.substring(0, 60)}..."`,
      );

      // Send initial reaction
      await message.reply(
        `🔄 Transforming your image... This might take a moment.`,
      );

      // Transform image
      const result = await ImageService.imageToImage(
        imageMedia.buffer,
        finalPrompt,
        {
          model,
          width: 1024,
          height: 1024,
          strength: 0.7,
        },
      );

      // Read the transformed image
      const fs = require("fs");
      const imageBuffer = fs.readFileSync(result.filepath);

      // Clean up after a delay
      setTimeout(() => {
        result.cleanup();
      }, 5000);

      // Return transformed image
      return {
        media: {
          image: imageBuffer,
          caption: `✨ *Image Transformed*\n\n🔄 Transformation: ${finalPrompt.substring(0, 100)}${finalPrompt.length > 100 ? "..." : ""}\n🎨 Model: ${model}\n\n*Powered by Pollinations AI*`,
        },
      };
    } catch (error) {
      console.error("❌ Image transformation error:", error);

      // Check if it's NSFW content
      if (error.message === "NSFW_CONTENT") {
        const rejections = ImageService.getNSFWRejectionResponses();
        return rejections[Math.floor(Math.random() * rejections.length)];
      }

      return `❌ Failed to transform image: ${error.message}\n\nTry with a different prompt or image!`;
    }
  }

  /**
   * Add viina image overlay to bottom-right of a target image.
   */
  async addViinaOverlay(args, message) {
    try {
      const fs = require("fs");
      const path = require("path");
      const sharp = require("sharp");

      const isImageMedia = (media) => {
        if (!media) return false;
        const mimetype = (media.mimetype || "").toLowerCase();
        return mimetype.startsWith("image/") && mimetype !== "image/webp";
      };

      let imageMedia = null;

      // Method 1: image sent with command caption
      if (message.hasMedia) {
        const media = await message.downloadMedia();
        if (isImageMedia(media)) {
          imageMedia = media;
        }
      }

      // Method 2: command replies to an image message
      if (!imageMedia && message.hasQuotedMsg) {
        const quotedMsg = await message.getQuotedMessage();
        if (quotedMsg && quotedMsg.hasMedia) {
          const media = await quotedMsg.downloadMedia();
          if (isImageMedia(media)) {
            imageMedia = media;
          }
        }
      }

      if (!imageMedia) {
        return "🍾 Use `-viina` on an image message or reply to an image with `-viina`.";
      }

      const baseBuffer = Buffer.isBuffer(imageMedia.buffer)
        ? imageMedia.buffer
        : typeof imageMedia.data === "string"
          ? Buffer.from(imageMedia.data, "base64")
          : null;

      if (!baseBuffer) {
        return "❌ I found the image but couldn't process it. Try again.";
      }

      const viinaImagePath = path.join(
        __dirname,
        "..",
        "viina",
        "PHOTO-2026-04-03-10-06-16.png",
      );

      if (!fs.existsSync(viinaImagePath)) {
        return "❌ Viina overlay image is missing from the viina folder.";
      }

      const viinaBuffer = fs.readFileSync(viinaImagePath);

      const baseImage = sharp(baseBuffer, { failOn: "none" });
      const baseMeta = await baseImage.metadata();

      if (!baseMeta.width || !baseMeta.height) {
        return "❌ Could not read image dimensions. Try another image.";
      }

      // Smart pipeline:
      // 1) Trim transparent padding so the hand, not the canvas, aligns to edges.
      // 2) Scale based on the smaller image dimension for consistent visual size.
      const targetMinDimension = Math.min(baseMeta.width, baseMeta.height);
      const overlayTarget = Math.max(140, Math.round(targetMinDimension * 0.5));

      const overlayPrepared = sharp(viinaBuffer, { failOn: "none" })
        .ensureAlpha()
        .trim()
        .resize({
          width: overlayTarget,
          height: overlayTarget,
          fit: "inside",
          withoutEnlargement: false,
        });

      const overlayBuffer = await overlayPrepared.png().toBuffer();
      const overlayMeta = await sharp(overlayBuffer, {
        failOn: "none",
      }).metadata();
      if (!overlayMeta.width || !overlayMeta.height) {
        return "❌ Could not process viina overlay image.";
      }

      // Hard anchor to right border with a tiny bleed so it always visually touches.
      const rightBleed = Math.max(1, Math.round(baseMeta.width * 0.003));
      const bottomMargin = Math.max(6, Math.round(baseMeta.height * 0.03));
      const left = Math.max(0, baseMeta.width - overlayMeta.width + rightBleed);
      const top = Math.max(
        0,
        baseMeta.height - overlayMeta.height - bottomMargin,
      );

      const composited = await sharp(baseBuffer, { failOn: "none" })
        .composite([
          {
            input: overlayBuffer,
            left,
            top,
          },
        ])
        .jpeg({ quality: 92 })
        .toBuffer();

      return {
        media: {
          image: composited,
          caption: "🍾 viina added",
        },
      };
    } catch (error) {
      console.error("Viina command error:", error);
      return "❌ Failed to apply viina overlay. Try again in a moment.";
    }
  }

  /**
   * Resend an image from current message or replied message
   */
  async resendImage(args, message) {
    try {
      const { message: rawMessage } = this.currentContext;

      // In groups, only admins can use this command.
      if (rawMessage?.groupId && rawMessage?.sock) {
        try {
          const groupMetadata = await rawMessage.sock.groupMetadata(
            rawMessage.groupId,
          );
          const senderParticipant = groupMetadata.participants.find(
            (p) => p.id === rawMessage.userId || p.lid === rawMessage.lid,
          );

          const isAdmin =
            senderParticipant &&
            (senderParticipant.admin === "admin" ||
              senderParticipant.admin === "superadmin");

          if (!isAdmin) {
            return "❌ `-vv` is admin-only in groups.";
          }
        } catch (adminCheckError) {
          console.error(
            "Failed to check admin status for -vv:",
            adminCheckError,
          );
          return "❌ Could not verify admin permissions for `-vv`.";
        }
      }

      let imageMedia = null;

      const isImageMedia = (media) => {
        if (!media) return false;
        const mimetype = (media.mimetype || "").toLowerCase();
        return mimetype.startsWith("image/");
      };

      // Method 1: Image sent with command
      if (message.hasMedia) {
        const media = await message.downloadMedia();
        if (isImageMedia(media)) {
          imageMedia = media;
        }
      }

      // Method 2: Reply to image
      if (!imageMedia && message.hasQuotedMsg) {
        const quotedMsg = await message.getQuotedMessage();
        if (quotedMsg && quotedMsg.hasMedia) {
          const media = await quotedMsg.downloadMedia();
          if (isImageMedia(media)) {
            imageMedia = media;
          }
        }
      }

      if (!imageMedia) {
        return "🖼️ Use `-vv` on an image message or reply to an image with `-vv`.";
      }

      const imageBuffer = Buffer.isBuffer(imageMedia.buffer)
        ? imageMedia.buffer
        : typeof imageMedia.data === "string"
          ? Buffer.from(imageMedia.data, "base64")
          : null;

      if (!imageBuffer) {
        return "❌ I found the image but couldn't process it. Try again.";
      }

      return {
        media: {
          image: imageBuffer,
        },
      };
    } catch (error) {
      console.error("Resend image command error:", error);
      return "❌ Failed to resend image. Try again in a moment.";
    }
  }

  /**
   * Reply-only command: fetch and send profile photo of the replied user.
   */
  async getRepliedUserPfp(args, message) {
    try {
      const { message: rawMessage, isNiceUser = false } = this.currentContext;

      if (!message.hasQuotedMsg || !message.quoted?.userId) {
        return "👤 Reply to someone's message with `-pfp` to get their profile photo.";
      }

      if (
        !rawMessage?.sock ||
        typeof rawMessage.sock.profilePictureUrl !== "function"
      ) {
        return "❌ Profile photo service is unavailable right now. Try again in a moment.";
      }

      const targetJid = message.quoted.userId;
      let profilePicUrl;

      try {
        profilePicUrl = await rawMessage.sock.profilePictureUrl(
          targetJid,
          "image",
        );
      } catch (ppError) {
        const errorText = String(
          ppError?.message || ppError || "",
        ).toLowerCase();
        if (
          errorText.includes("not-authorized") ||
          errorText.includes("status code: 404")
        ) {
          return isNiceUser
            ? "That person doesn't have a visible profile photo right now. 😊"
            : "No visible profile photo for that user. Privacy settings, probably. 🙄";
        }
        throw ppError;
      }

      if (!profilePicUrl) {
        return isNiceUser
          ? "I couldn't find a profile photo for that user. 😊"
          : "Couldn't fetch their profile photo. Either none exists or it's private. 🙄";
      }

      const axios = require("axios");
      const response = await axios.get(profilePicUrl, {
        responseType: "arraybuffer",
      });
      const pfpBuffer = Buffer.from(response.data);

      const targetNumber = targetJid.split("@")[0];
      return {
        media: {
          image: pfpBuffer,
          caption: `👤 Profile photo for @${targetNumber}`,
          mentions: [targetJid],
        },
      };
    } catch (error) {
      console.error("PFP command error:", error);
      return "❌ Failed to fetch profile photo. Try again in a moment.";
    }
  }

  /**
   * Reply-only command: convert sticker to regular media and resend.
   */
  async upscaleSticker(args, message) {
    try {
      if (!message.hasQuotedMsg) {
        return "✨ Reply to a sticker with `-upscale` or `-up`.";
      }

      const quotedMsg = await message.getQuotedMessage();
      if (!quotedMsg || !quotedMsg.hasMedia) {
        return "❌ Replied message has no media. Reply to a sticker.";
      }

      const stickerMedia = await quotedMsg.downloadMedia();
      if (!stickerMedia) {
        return "❌ Couldn't download the sticker. Try again.";
      }

      const mimetype = (stickerMedia.mimetype || "").toLowerCase();
      if (mimetype !== "image/webp") {
        return "❌ This command only works when replying to a sticker.";
      }

      const stickerBuffer = Buffer.isBuffer(stickerMedia.buffer)
        ? stickerMedia.buffer
        : typeof stickerMedia.data === "string"
          ? Buffer.from(stickerMedia.data, "base64")
          : null;

      if (!stickerBuffer) {
        return "❌ Failed to process sticker data.";
      }

      const converted = await this.stickerService.convertStickerToDisplayMedia(
        stickerBuffer,
        `upscale_${Date.now()}`,
      );

      if (converted.type === "video") {
        return {
          media: {
            video: converted.buffer,
            mimetype: converted.mimetype,
            gifPlayback: true,
          },
        };
      }

      return {
        media: {
          image: converted.buffer,
          mimetype: converted.mimetype,
        },
      };
    } catch (error) {
      console.error("Upscale sticker command error:", error);
      return "❌ Failed to upscale sticker. Try again in a moment.";
    }
  }

  /**
   * Admin command: Mute a user for a duration
   */
  async handleMute(args, message) {
    try {
      const { senderName = "User", message: rawMessage } = this.currentContext;

      if (!rawMessage.groupId) {
        return "⚠️ This command can only be used in groups!";
      }

      const groupJid = rawMessage.groupId;
      const adminJid = rawMessage.userId;
      const groupMetadata = await rawMessage.sock.groupMetadata(groupJid);

      const issuerParticipant = groupMetadata.participants.find(
        (p) => p.id === adminJid || p.lid === rawMessage.lid,
      );

      let targetJid = null;
      if (rawMessage.quoted?.userId) {
        targetJid = rawMessage.quoted.userId;
      } else if (rawMessage.mentions && rawMessage.mentions.length > 0) {
        targetJid = rawMessage.mentions[0];
      }

      const targetParticipant = targetJid
        ? this.findParticipantByJid(groupMetadata, targetJid)
        : null;
      const targetIsAdmin =
        !!targetParticipant &&
        (targetParticipant.admin === "admin" ||
          targetParticipant.admin === "superadmin");

      // Special behavior: non-admin attempting to mute an admin gets self-muted.
      if (
        (!issuerParticipant ||
          (issuerParticipant.admin !== "admin" &&
            issuerParticipant.admin !== "superadmin")) &&
        targetJid &&
        targetIsAdmin
      ) {
        const selfMuteMs = 5 * 60 * 1000;
        const selfNumber = adminJid.split("@")[0];
        const selfMuteeName = issuerParticipant?.notify || issuerParticipant?.name || selfNumber;
        const selfMute = this.muteStore.setMute(
          adminJid,
          groupJid,
          "eden-self-defense",
          selfMuteMs,
          "Tried to mute an admin without admin rights",
          selfMuteeName,
        );

        const remainingText = this.formatRemainingTime(selfMuteMs);
        const canMessageAt = new Date(selfMute.expiresAt).toLocaleString();

        await rawMessage.reply(
          `🎪 *UNO Reverse Card Activated*\n\n@${selfNumber}, bold move trying to mute an admin without powers.\nSo I muted *you* for 5 minutes instead.\n\n⏳ Remaining: ${remainingText}\n🕒 You can talk again: ${canMessageAt}\n\nLesson unlocked: admin commands are not a democracy.`,
          rawMessage.raw,
          [adminJid],
        );

        return null;
      }

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only admins can use this command!";
      }

      const botJid = rawMessage.sock.user?.id;
      const botLid = rawMessage.sock.user?.lid;
      const botParticipant = groupMetadata.participants.find((p) => {
        const botNumber = botJid?.split(":")[0]?.split("@")[0];
        const botLidNumber = botLid?.split(":")[0]?.split("@")[0];
        const pJidNumber = p.jid?.split("@")[0];
        const pIdNumber = p.id?.split("@")[0];
        return pJidNumber === botNumber || pIdNumber === botLidNumber;
      });

      if (
        !botParticipant ||
        (botParticipant.admin !== "admin" &&
          botParticipant.admin !== "superadmin")
      ) {
        return "❌ I need to be an admin to enforce mutes!";
      }

      if (!targetJid) {
        return "❌ *Invalid Usage*\n\nUse one of these:\n1️⃣ Reply to a message: `-mute 5m`\n2️⃣ Mention a user: `-mute @user 5m`\n\nSupported units: `m`, `h`, `d`";
      }

      const durationToken = args.find((arg) => /^\d+[mhd]$/i.test(arg));
      const duration = this.parseMuteDuration(durationToken);

      if (!duration) {
        return "❌ Please provide a valid duration.\n\nExamples:\n• `-mute @user 2m`\n• `-mute @user 2h`\n• `-mute @user 2d`\n• Reply + `-mute 5m`";
      }

      if (targetIsAdmin) {
        return "❌ Cannot mute group admins!";
      }

      const mentionMeta = this.buildMentionMeta(targetJid, groupMetadata);
      const senderNumber = mentionMeta.mentionNumber;
      const targetParticipantName = mentionMeta.participant?.notify || mentionMeta.participant?.name || senderNumber;

      const reason = args
        .filter((arg) => arg !== durationToken && !arg.startsWith("@"))
        .join(" ")
        .trim();

      const muteResult = this.muteStore.setMute(
        targetJid,
        groupJid,
        adminJid,
        duration.ms,
        reason,
        targetParticipantName,
      );

      const expiresAtText = new Date(muteResult.expiresAt).toLocaleString();
      const remainingText = this.formatRemainingTime(duration.ms);

      await rawMessage.reply(
        `🔇 *User Muted*\n\n👤 User: @${senderNumber}\n⏳ Duration: ${duration.amount}${duration.unit}\n⌛ Remaining: ${remainingText}\n🕒 Can message again: ${expiresAtText}${reason ? `\n📋 Reason: ${reason}` : ""}\n\n*Muted by:* ${senderName}`,
        rawMessage.raw,
        mentionMeta.mentionJids,
      );

      return null;
    } catch (error) {
      console.error("❌ Mute command error:", error);
      return `❌ Failed to mute user: ${error.message}`;
    }
  }

  /**
   * Admin command: Remove active mute from a user
   */
  async handleUnmute(args, message) {
    try {
      const { senderName = "User", message: rawMessage } = this.currentContext;

      if (!rawMessage.groupId) {
        return "⚠️ This command can only be used in groups!";
      }

      const groupJid = rawMessage.groupId;
      const adminJid = rawMessage.userId;
      const groupMetadata = await rawMessage.sock.groupMetadata(groupJid);
      const issuerParticipant = groupMetadata.participants.find(
        (p) => p.id === adminJid || p.lid === rawMessage.lid,
      );

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only admins can use this command!";
      }

      let targetJid = null;
      if (rawMessage.quoted?.userId) {
        targetJid = rawMessage.quoted.userId;
      } else if (rawMessage.mentions && rawMessage.mentions.length > 0) {
        targetJid = rawMessage.mentions[0];
      } else {
        return "❌ *Invalid Usage*\n\nUse one of these:\n1️⃣ Reply to a message: `-unmute`\n2️⃣ Mention a user: `-unmute @user`";
      }

      const mentionMeta = this.buildMentionMeta(targetJid, groupMetadata);
      const senderNumber = mentionMeta.mentionNumber;

      const removed = this.muteStore.clearMute(targetJid, groupJid);
      if (!removed) {
        await rawMessage.reply(
          `ℹ️ @${senderNumber} is not currently muted.`,
          rawMessage.raw,
          mentionMeta.mentionJids,
        );
        return null;
      }

      await rawMessage.reply(
        `🔊 *User Unmuted*\n\n👤 User: @${senderNumber}\n✅ Mute removed successfully.\n\n*Unmuted by:* ${senderName}`,
        rawMessage.raw,
        mentionMeta.mentionJids,
      );

      return null;
    } catch (error) {
      console.error("❌ Unmute command error:", error);
      return `❌ Failed to unmute user: ${error.message}`;
    }
  }

  /**
   * Admin command: Show active mute list
   */
  async handleMuteList(args, message) {
    try {
      const { message: rawMessage } = this.currentContext;

      if (!rawMessage.groupId) {
        return "⚠️ This command can only be used in groups!";
      }

      const groupJid = rawMessage.groupId;
      const adminJid = rawMessage.userId;
      const groupMetadata = await rawMessage.sock.groupMetadata(groupJid);
      const issuerParticipant = groupMetadata.participants.find(
        (p) => p.id === adminJid || p.lid === rawMessage.lid,
      );

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only admins can use this command!";
      }

      const activeMutes = this.muteStore.getGroupMutes(groupJid);
      if (!activeMutes.length) {
        return "🔇 *Mute List*\n\nNo users are currently muted.";
      }

      const lines = ["🔇 *Active Mute List*", ""];
      const mentionJids = [];
      for (let i = 0; i < activeMutes.length; i += 1) {
        const mute = activeMutes[i];
        const mentionMeta = this.buildMentionMeta(mute.user_jid, groupMetadata);
        
        // Use stored name from database, fallback to participant name or number
        let displayName = mute.user_name;
        if (!displayName && mentionMeta.participant && (mentionMeta.participant.notify || mentionMeta.participant.name)) {
          displayName = mentionMeta.participant.notify || mentionMeta.participant.name;
        }
        if (!displayName) {
          displayName = mentionMeta.mentionNumber || mute.user_key;
          // For LID numbers (very long), show last 10 digits
          if (displayName.length > 10) {
            displayName = displayName.slice(-10);
          }
        }
        
        const remaining = this.formatRemainingTime(
          Math.max(0, mute.expires_at - Date.now()),
        );
        const until = new Date(mute.expires_at).toLocaleString();

        lines.push(`${i + 1}. @${displayName}`);
        lines.push(`   ⏳ Remaining: ${remaining}`);
        lines.push(`   🕒 Until: ${until}`);

        if (mentionMeta.preferredJid && !mentionJids.includes(mentionMeta.preferredJid)) {
          mentionJids.push(mentionMeta.preferredJid);
        }
      }

      await rawMessage.reply(lines.join("\n"), rawMessage.raw, mentionJids);
      return null;
    } catch (error) {
      console.error("❌ Mutelist command error:", error);
      return `❌ Failed to show mute list: ${error.message}`;
    }
  }

  /**
   * Admin command: Ban a user from the group
   */
  async handleBan(args, message) {
    try {
      const { senderName = "User", message: rawMessage } = this.currentContext;

      if (!rawMessage.groupId) {
        return "⚠️ This command can only be used in groups!";
      }

      const groupJid = rawMessage.groupId;
      const adminJid = rawMessage.userId;
      const groupMetadata = await rawMessage.sock.groupMetadata(groupJid);
      const issuerParticipant = groupMetadata.participants.find(
        (p) => p.id === adminJid || p.lid === rawMessage.lid,
      );

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only admins can use this command!";
      }

      let targetJid = null;
      if (rawMessage.quoted?.userId) {
        targetJid = rawMessage.quoted.userId;
      } else if (rawMessage.mentions && rawMessage.mentions.length > 0) {
        targetJid = rawMessage.mentions[0];
      }

      if (!targetJid) {
        return "❌ *Invalid Usage*\n\nUse one of these:\n1️⃣ Reply to a message: `-ban`\n2️⃣ Mention a user: `-ban @user [reason]`";
      }

      const targetParticipant = this.findParticipantByJid(groupMetadata, targetJid);
      const targetIsAdmin =
        !!targetParticipant &&
        (targetParticipant.admin === "admin" ||
          targetParticipant.admin === "superadmin");

      if (targetIsAdmin) {
        return "❌ Cannot ban group admins!";
      }

      const mentionMeta = this.buildMentionMeta(targetJid, groupMetadata);
      const senderNumber = mentionMeta.mentionNumber;
      const targetParticipantName = mentionMeta.participant?.notify || mentionMeta.participant?.name || senderNumber;

      const reason = args
        .filter((arg) => !arg.startsWith("@"))
        .join(" ")
        .trim();

      // Store the ban
      this.banStore.setBan(
        targetJid,
        groupJid,
        adminJid,
        reason,
        targetParticipantName,
        senderNumber,
      );

      // Kick them immediately
      try {
        await rawMessage.sock.groupParticipantsUpdate(
          groupJid,
          [targetJid],
          "remove",
        );
        console.log(`🚫 Kicked banned user ${targetJid} from ${groupJid}`);
      } catch (kickError) {
        console.error("Error kicking user:", kickError);
      }

      await rawMessage.reply(
        `🚫 *User Banned*\n\n👤 User: @${senderNumber}\n📋 Name: ${targetParticipantName}\n${reason ? `📝 Reason: ${reason}\n` : ""}\n*Banned by:* ${senderName}\n\n⚠️ This user will be automatically removed if they're added back.`,
        rawMessage.raw,
        mentionMeta.mentionJids,
      );

      return null;
    } catch (error) {
      console.error("❌ Ban command error:", error);
      return `❌ Failed to ban user: ${error.message}`;
    }
  }

  /**
   * Admin command: Remove a ban using phone number
   */
  async handleUnban(args, message) {
    try {
      const { senderName = "User", message: rawMessage } = this.currentContext;

      if (!rawMessage.groupId) {
        return "⚠️ This command can only be used in groups!";
      }

      const groupJid = rawMessage.groupId;
      const adminJid = rawMessage.userId;
      const groupMetadata = await rawMessage.sock.groupMetadata(groupJid);
      const issuerParticipant = groupMetadata.participants.find(
        (p) => p.id === adminJid || p.lid === rawMessage.lid,
      );

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only admins can use this command!";
      }

      const phoneNumber = args[0];
      if (!phoneNumber) {
        return "❌ *Invalid Usage*\n\nUse: `-unban [phone number]`\n\nExample: `-unban 1234567890`";
      }

      const ban = this.banStore.getBanByPhoneNumber(phoneNumber, groupJid);
      if (!ban) {
        return `ℹ️ User with phone number **${phoneNumber}** is not banned.`;
      }

      const removed = this.banStore.clearBan(ban.user_jid, groupJid);
      if (!removed) {
        return `ℹ️ Could not find ban for phone number **${phoneNumber}**.`;
      }

      await rawMessage.reply(
        `✅ *User Unbanned*\n\n👤 Name: ${ban.user_name}\n📱 Phone: ${ban.phone_number}\n\n*Unbanned by:* ${senderName}`,
        rawMessage.raw,
      );

      return null;
    } catch (error) {
      console.error("❌ Unban command error:", error);
      return `❌ Failed to unban user: ${error.message}`;
    }
  }

  /**
   * Admin command: Show list of banned users
   */
  async handleBanList(args, message) {
    try {
      const { message: rawMessage } = this.currentContext;

      if (!rawMessage.groupId) {
        return "⚠️ This command can only be used in groups!";
      }

      const groupJid = rawMessage.groupId;
      const adminJid = rawMessage.userId;
      const groupMetadata = await rawMessage.sock.groupMetadata(groupJid);
      const issuerParticipant = groupMetadata.participants.find(
        (p) => p.id === adminJid || p.lid === rawMessage.lid,
      );

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only admins can use this command!";
      }

      const bannedUsers = this.banStore.getGroupBans(groupJid);
      if (!bannedUsers.length) {
        return "🚫 *Ban List*\n\nNo users are currently banned.";
      }

      const lines = ["🚫 *Banned Users*", ""];
      for (let i = 0; i < bannedUsers.length; i += 1) {
        const ban = bannedUsers[i];
        const banDate = new Date(ban.timestamp).toLocaleString();

        lines.push(`${i + 1}. ${ban.user_name}`);
        lines.push(`   📱 Phone: ${ban.phone_number}`);
        lines.push(`   📅 Banned: ${banDate}`);
        if (ban.reason) {
          lines.push(`   📝 Reason: ${ban.reason}`);
        }
        lines.push("");
      }

      await rawMessage.reply(lines.join("\n"), rawMessage.raw);
      return null;
    } catch (error) {
      console.error("❌ Banlist command error:", error);
      return `❌ Failed to show ban list: ${error.message}`;
    }
  }

  /**
   * Admin command: Warn a user
   */
  async handleWarn(args, message) {
    try {
      const { senderName = "User", message: rawMessage } = this.currentContext;

      // Check if this is a group chat
      if (!rawMessage.groupId) {
        return "⚠️ This command can only be used in groups!";
      }

      const groupJid = rawMessage.groupId;
      const adminJid = rawMessage.userId;

      // Check if the command issuer is an admin
      const groupMetadata = await rawMessage.sock.groupMetadata(groupJid);
      const issuerParticipant = groupMetadata.participants.find(
        (p) => p.id === adminJid || p.lid === rawMessage.lid,
      );

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only admins can use this command!";
      }

      // Check if Eden is an admin - get bot's JID and LID from sock.user
      const botJid = rawMessage.sock.user?.id;
      const botLid = rawMessage.sock.user?.lid;

      // Match bot using either jid or lid fields
      const botParticipant = groupMetadata.participants.find((p) => {
        const botNumber = botJid?.split(":")[0]?.split("@")[0];
        const botLidNumber = botLid?.split(":")[0]?.split("@")[0];
        const pJidNumber = p.jid?.split("@")[0];
        const pIdNumber = p.id?.split("@")[0];
        return pJidNumber === botNumber || pIdNumber === botLidNumber;
      });

      if (!botParticipant) {
        return "❌ I need to be an admin to warn users! (Bot not found in group)";
      }

      if (
        botParticipant.admin !== "admin" &&
        botParticipant.admin !== "superadmin"
      ) {
        return "❌ I need to be an admin to warn users! (Bot is not an admin)";
      }

      let targetJid = null;
      let reason = "";

      // Method 1: Check if replying to a message
      if (rawMessage.quoted?.userId) {
        targetJid = rawMessage.quoted.userId;
        reason = args.join(" ").trim() || "No reason provided";
      }
      // Method 2: Check if mentioning a user
      else if (rawMessage.mentions && rawMessage.mentions.length > 0) {
        targetJid = rawMessage.mentions[0];
        // Remove mention from args to get reason
        const fullText = args.join(" ");
        reason = fullText.replace(/@\d+/g, "").trim() || "No reason provided";
      } else {
        return `❌ *Invalid Usage*\n\nPlease use one of these methods:\n1️⃣ Reply to a message: \`-warn [reason]\`\n2️⃣ Mention a user: \`-warn @user [reason]\``;
      }

      // Don't allow warning admins
      // Match participant by jid (actual WhatsApp JID), id (LID), or lid fields
      const targetParticipant = groupMetadata.participants.find(
        (p) => p.jid === targetJid || p.id === targetJid || p.lid === targetJid,
      );

      if (
        targetParticipant &&
        (targetParticipant.admin === "admin" ||
          targetParticipant.admin === "superadmin")
      ) {
        return "❌ Cannot warn group admins!";
      }

      // Get the actual JID for proper mentions
      // If targetJid is already actual JID format (@s.whatsapp.net), use it
      // Otherwise use participant.jid to convert from LID to actual JID
      const actualJid = targetJid.includes("@s.whatsapp.net")
        ? targetJid
        : targetParticipant?.jid || targetJid;
      const mentionNumber = actualJid.split("@")[0];

      // Add warning to database
      const warningCount = this.warningStore.addWarning(
        targetJid,
        groupJid,
        reason,
        adminJid,
      );

      console.log(
        `⚠️ ${senderName} warned user ${targetJid} in ${groupJid}. Total warnings: ${warningCount}`,
      );

      // Generate an insult based on the warning reason
      let insult = "";
      try {
        insult = await this.llmService.generateMeanResponse(
          `Someone was warned for: "${reason}". Generate a savage, brutal roast (1-2 sentences max) mocking them harshly for this behavior. Be ruthless and cutting.`,
          "Be extremely sarcastic, savage, and brutal. Make it hurt. Channel your inner mean girl/bully. Keep it brief but devastating. Make them regret their actions.",
        );
      } catch (error) {
        console.error("Error generating insult:", error);
        // Fallback insults - make them more brutal
        const fallbackInsults = [
          "Wow, imagine being THAT person. Embarrassing. 🤦",
          "Your decision-making skills are a crime against humanity. 😤",
          "Congratulations on being the group disappointment. 👏😂",
          "Nature is healing... by removing you from the gene pool. 🗑️",
          "Your brain really said 'I'm gonna sit this one out' huh? 🧠❌",
        ];
        insult =
          fallbackInsults[Math.floor(Math.random() * fallbackInsults.length)];
      }

      // If user has 3 or more warnings, kick them
      if (warningCount >= 3) {
        try {
          // Remove user from group
          await rawMessage.sock.groupParticipantsUpdate(
            groupJid,
            [targetJid],
            "remove",
          );

          // Clear warnings after kicking
          this.warningStore.clearWarnings(targetJid, groupJid);

          // Generate a funny farewell message
          const farewellMessages = [
            "Good riddance! 👋",
            "Don't let the door hit you on the way out! 🚪",
            "And nothing of value was lost... 🗑️",
            "Bye Felicia! 👋😂",
            "You've been voted off the island! 🏝️",
            "See ya, wouldn't wanna be ya! 👋",
            "Pack your bags, you're outta here! 🎒",
            "Thanks for playing, better luck next time! 🎮",
            "Your free trial of this group has expired! ⏰",
            "Hasta la vista, baby! 🤖",
            "You just got Eden'd! 😎",
            "One less problem for us! 🎉",
            "The group IQ just went up! 🧠📈",
          ];
          const farewell =
            farewellMessages[
              Math.floor(Math.random() * farewellMessages.length)
            ];

          // Send message with mention using actual JID
          await rawMessage.reply(
            `⚠️ *User Removed*\n\n👤 User: @${mentionNumber}\n📋 Reason: ${reason}\n\n🚫 User has been removed from the group after receiving 3 warnings.\n\n${farewell}\n\n*Warned by:* ${senderName}`,
            rawMessage.raw,
            [actualJid],
          );

          return null; // Already sent reply
        } catch (error) {
          console.error("Error kicking user:", error);
          return `⚠️ *Warning #${warningCount} Issued*\n\n👤 User: @${mentionNumber}\n📋 Reason: ${reason}\n\n🚫 User has 3 warnings but I couldn't remove them. Please check my admin permissions!\n\n*Warned by:* ${senderName}`;
        }
      }

      // Send warning message with mention and insult using actual JID
      await rawMessage.reply(
        `⚠️ *Warning Issued*\n\n👤 User: @${mentionNumber}\n📋 Reason: ${reason}\n🔢 Warnings: ${warningCount}/3\n\n${insult}\n\n${warningCount === 2 ? "⚡ *Final Warning!* One more warning and you'll be removed from the group." : `⏰ ${3 - warningCount} warning(s) remaining`}\n\n*Warned by:* ${senderName}`,
        rawMessage.raw,
        [actualJid],
      );

      return null; // Already sent reply
    } catch (error) {
      console.error("❌ Warn command error:", error);
      return `❌ Failed to warn user: ${error.message}`;
    }
  }

  /**
   * Admin command: Kick a user
   */
  async handleKick(args, message) {
    try {
      const { senderName = "User", message: rawMessage } = this.currentContext;

      // Check if this is a group chat
      if (!rawMessage.groupId) {
        return "⚠️ This command can only be used in groups!";
      }

      const groupJid = rawMessage.groupId;
      const adminJid = rawMessage.userId;

      // Check if the command issuer is an admin
      const groupMetadata = await rawMessage.sock.groupMetadata(groupJid);
      const issuerParticipant = groupMetadata.participants.find(
        (p) => p.id === adminJid || p.lid === rawMessage.lid,
      );

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only admins can use this command!";
      }

      // Check if Eden is an admin - get bot's JID and LID from sock.user
      const botJid = rawMessage.sock.user?.id;
      const botLid = rawMessage.sock.user?.lid;

      // Match bot using either jid or lid fields
      const botParticipant = groupMetadata.participants.find((p) => {
        const botNumber = botJid?.split(":")[0]?.split("@")[0];
        const botLidNumber = botLid?.split(":")[0]?.split("@")[0];
        const pJidNumber = p.jid?.split("@")[0];
        const pIdNumber = p.id?.split("@")[0];
        return pJidNumber === botNumber || pIdNumber === botLidNumber;
      });

      if (!botParticipant) {
        return "❌ I need to be an admin to kick users! (Bot not found in group)";
      }

      if (
        botParticipant.admin !== "admin" &&
        botParticipant.admin !== "superadmin"
      ) {
        return "❌ I need to be an admin to kick users! (Bot is not an admin)";
      }

      let targetJid = null;

      // Method 1: Check if replying to a message
      if (rawMessage.quoted?.userId) {
        targetJid = rawMessage.quoted.userId;
      }
      // Method 2: Check if mentioning a user
      else if (rawMessage.mentions && rawMessage.mentions.length > 0) {
        targetJid = rawMessage.mentions[0];
      } else {
        return `❌ *Invalid Usage*\n\nPlease use one of these methods:\n1️⃣ Reply to a message: \`-kick\`\n2️⃣ Mention a user: \`-kick @user\``;
      }

      // Don't allow kicking admins
      // Match participant by jid (actual WhatsApp JID), id (LID), or lid fields
      const targetParticipant = groupMetadata.participants.find(
        (p) => p.jid === targetJid || p.id === targetJid || p.lid === targetJid,
      );

      if (
        targetParticipant &&
        (targetParticipant.admin === "admin" ||
          targetParticipant.admin === "superadmin")
      ) {
        return "❌ Cannot kick group admins!";
      }

      // Get the actual JID for proper mentions
      // If targetJid is already actual JID format (@s.whatsapp.net), use it
      // Otherwise use participant.jid to convert from LID to actual JID
      const actualJid = targetJid.includes("@s.whatsapp.net")
        ? targetJid
        : targetParticipant?.jid || targetJid;
      const mentionNumber = actualJid.split("@")[0];

      // Get warning history for context
      const warningCount = this.warningStore.getWarningCount(
        targetJid,
        groupJid,
      );

      try {
        // Remove user from group
        await rawMessage.sock.groupParticipantsUpdate(
          groupJid,
          [targetJid],
          "remove",
        );

        // Clear warnings after kicking
        this.warningStore.clearWarnings(targetJid, groupJid);

        console.log(
          `🚫 ${senderName} kicked user ${targetJid} from ${groupJid}`,
        );

        const warningNote =
          warningCount > 0 ? `\n📊 User had ${warningCount} warning(s).` : "";

        // Generate a funny farewell message
        const farewellMessages = [
          "Good riddance! 👋",
          "Don't let the door hit you on the way out! 🚪",
          "And nothing of value was lost... 🗑️",
          "Bye Felicia! 👋😂",
          "You've been voted off the island! 🏝️",
          "See ya, wouldn't wanna be ya! 👋",
          "Pack your bags, you're outta here! 🎒",
          "Thanks for playing, better luck next time! 🎮",
          "Your free trial of this group has expired! ⏰",
          "Hasta la vista, baby! 🤖",
          "You just got Eden'd! 😎",
          "One less problem for us! 🎉",
          "The group IQ just went up! 🧠📈",
          "Enjoy your freedom... from us! 🕊️",
          "Better luck in your next group! 🍀",
          "Congratulations on your exit! 🎊",
        ];
        const farewell =
          farewellMessages[Math.floor(Math.random() * farewellMessages.length)];

        // Send message with mention using actual JID
        await rawMessage.reply(
          `🚫 *User Removed*\n\n👤 User: @${mentionNumber}${warningNote}\n\n${farewell}\n\n*Kicked by:* ${senderName}`,
          rawMessage.raw,
          [actualJid],
        );

        return null; // Already sent reply
      } catch (error) {
        console.error("Error kicking user:", error);
        return `❌ Failed to remove user: ${error.message}\n\nPlease check my admin permissions!`;
      }
    } catch (error) {
      console.error("❌ Kick command error:", error);
      return `❌ Failed to kick user: ${error.message}`;
    }
  }

  /**
   * Admin command: Show warnings for a user
   */
  async handleShow(args, message) {
    try {
      const { senderName = "User", message: rawMessage } = this.currentContext;

      // Check if this is a group chat
      if (!rawMessage.groupId) {
        return "⚠️ This command can only be used in groups!";
      }

      const groupJid = rawMessage.groupId;
      const adminJid = rawMessage.userId;

      // Check if the command issuer is an admin
      const groupMetadata = await rawMessage.sock.groupMetadata(groupJid);
      const issuerParticipant = groupMetadata.participants.find(
        (p) => p.id === adminJid || p.lid === rawMessage.lid,
      );

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only admins can use this command!";
      }

      let targetJid = null;

      // Method 1: Check if replying to a message
      if (rawMessage.quoted?.userId) {
        targetJid = rawMessage.quoted.userId;
      }
      // Method 2: Check if mentioning a user
      else if (rawMessage.mentions && rawMessage.mentions.length > 0) {
        targetJid = rawMessage.mentions[0];
      } else {
        return `❌ *Invalid Usage*\n\nPlease use one of these methods:\n1️⃣ Reply to a message: \`-show\`\n2️⃣ Mention a user: \`-show @user\``;
      }

      // Get the target participant for proper mention JID
      // Match participant by jid (actual WhatsApp JID), id (LID), or lid fields
      const targetParticipant = groupMetadata.participants.find(
        (p) => p.jid === targetJid || p.id === targetJid || p.lid === targetJid,
      );

      // Get the actual JID for proper mentions
      // If targetJid is already actual JID format (@s.whatsapp.net), use it
      // Otherwise use participant.jid to convert from LID to actual JID
      const actualJid = targetJid.includes("@s.whatsapp.net")
        ? targetJid
        : targetParticipant?.jid || targetJid;
      const mentionNumber = actualJid.split("@")[0];

      // Get all warnings for this user
      const warnings = this.warningStore.getWarnings(targetJid, groupJid);
      const warningCount = warnings.length;

      if (warningCount === 0) {
        return `✨ *Clean Record*\n\n👤 User: @${mentionNumber}\n\n🎉 This user has no warnings! They're being... surprisingly well-behaved. For now.`;
      }

      // Format warnings list
      let warningsList = "";
      warnings.forEach((warning, index) => {
        const date = new Date(warning.timestamp);
        const dateStr = date.toLocaleDateString();
        warningsList += `\n${index + 1}. *${warning.reason}*\n   📅 ${dateStr}`;
      });

      // Generate an insult based on all the warnings
      let insult = "";
      try {
        const reasons = warnings.map((w) => w.reason).join(", ");
        insult = await this.llmService.generateMeanResponse(
          `Someone has been warned ${warningCount} time(s) for these reasons: "${reasons}". Generate a witty, sarcastic roast (2-3 sentences) about their behavior pattern.`,
          "Be clever, sarcastic, and funny. Mock their inability to follow simple rules. Make it memorable.",
        );
      } catch (error) {
        console.error("Error generating insult:", error);
        // Fallback insults based on warning count
        const fallbackInsults = [
          "Wow, quite the track record you've got there. Should I get you a trophy? 🏆",
          "Some people learn from mistakes. You, apparently, collect them. 📚",
          "Is rule-breaking a hobby or are you just naturally talented at it? 🎯",
          "At this rate, you'll have your own Wikipedia page for 'What Not To Do'. 📖",
          "I'm impressed by your consistency... in making poor choices. 👏",
        ];
        insult =
          fallbackInsults[Math.floor(Math.random() * fallbackInsults.length)];
      }

      // Send message with mention using actual JID
      await rawMessage.reply(
        `⚠️ *Warning History*\n\n👤 User: @${mentionNumber}\n🔢 Total Warnings: ${warningCount}/3\n\n📋 *Violations:*${warningsList}\n\n💬 *Eden's Take:*\n${insult}\n\n${warningCount === 2 ? "⚡ *One more warning and they're out!*" : warningCount === 1 ? "⏰ 2 more warnings until removal" : "⏰ 1 more warning until removal"}`,
        rawMessage.raw,
        [actualJid],
      );

      return null; // Already sent reply
    } catch (error) {
      console.error("❌ Show command error:", error);
      return `❌ Failed to show warnings: ${error.message}`;
    }
  }

  /**
   * Admin command: Clear warnings for a user
   */
  async handleClean(args, message) {
    try {
      const { senderName = "User", message: rawMessage } = this.currentContext;

      // Check if this is a group chat
      if (!rawMessage.groupId) {
        return "⚠️ This command can only be used in groups!";
      }

      const groupJid = rawMessage.groupId;
      const adminJid = rawMessage.userId;

      // Check if the command issuer is an admin
      const groupMetadata = await rawMessage.sock.groupMetadata(groupJid);
      const issuerParticipant = groupMetadata.participants.find(
        (p) => p.id === adminJid || p.lid === rawMessage.lid,
      );

      if (
        !issuerParticipant ||
        (issuerParticipant.admin !== "admin" &&
          issuerParticipant.admin !== "superadmin")
      ) {
        return "❌ Only admins can use this command!";
      }

      let targetJid = null;

      // Method 1: Check if replying to a message
      if (rawMessage.quoted?.userId) {
        targetJid = rawMessage.quoted.userId;
      }
      // Method 2: Check if mentioning a user
      else if (rawMessage.mentions && rawMessage.mentions.length > 0) {
        targetJid = rawMessage.mentions[0];
      } else {
        return `❌ *Invalid Usage*\n\nPlease use one of these methods:\n1️⃣ Reply to a message: \`-clean\`\n2️⃣ Mention a user: \`-clean @user\``;
      }

      // Get the target participant for proper mention JID
      // Match participant by jid (actual WhatsApp JID), id (LID), or lid fields
      const targetParticipant = groupMetadata.participants.find(
        (p) => p.jid === targetJid || p.id === targetJid || p.lid === targetJid,
      );

      // Get the actual JID for proper mentions
      // If targetJid is already actual JID format (@s.whatsapp.net), use it
      // Otherwise use participant.jid to convert from LID to actual JID
      const actualJid = targetJid.includes("@s.whatsapp.net")
        ? targetJid
        : targetParticipant?.jid || targetJid;
      const mentionNumber = actualJid.split("@")[0];

      // Get warning count before clearing
      const warningCount = this.warningStore.getWarningCount(
        targetJid,
        groupJid,
      );

      if (warningCount === 0) {
        return `✨ *Already Clean*\n\n👤 User: @${mentionNumber}\n\n🎉 This user has no warnings to clear!`;
      }

      // Clear warnings
      this.warningStore.clearWarnings(targetJid, groupJid);

      console.log(
        `🧹 ${senderName} cleared ${warningCount} warning(s) for ${targetJid} in ${groupJid}`,
      );

      // Send message with mention using actual JID
      await rawMessage.reply(
        `🧹 *Warnings Cleared*\n\n👤 User: @${mentionNumber}\n📊 Warnings Removed: ${warningCount}\n\n✨ Slate wiped clean! They better not mess this up again...\n\n*Cleared by:* ${senderName}`,
        rawMessage.raw,
        [actualJid],
      );

      return null; // Already sent reply
    } catch (error) {
      console.error("❌ Clean command error:", error);
      return `❌ Failed to clear warnings: ${error.message}`;
    }
  }
}

// 207099061624867

module.exports = CommandHandler;
