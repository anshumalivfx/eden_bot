const StickerService = require("../services/stickerService");
const VoiceService = require("../services/voiceService");
const YouTubeService = require("../services/youtubeService");
const InteractionService = require("../services/interactionService");
const PetService = require("../services/petService");
const DubService = require("../services/dubService");
const DubUsageStore = require("../database/dubUsageStore");

class CommandHandler {
  constructor(llmService) {
    this.llmService = llmService;
    this.stickerService = new StickerService();
    this.voiceService = VoiceService;
    this.youtubeService = new YouTubeService();
    this.interactionService = new InteractionService();
    this.petService = new PetService();
    this.currentContext = {};
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
      voice: this.createVoice.bind(this),
      v: this.createVoice.bind(this), // Short alias for voice
      speak: this.createVoice.bind(this),
      tts: this.createVoice.bind(this), // Text-to-speech alias
      dub: this.dubVoiceMessage.bind(this),
      d: this.dubVoiceMessage.bind(this), // Short alias for dub
      play: this.playMusic.bind(this),
      song: this.playMusic.bind(this), // Alias for play
      music: this.playMusic.bind(this), // Alias for play
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
    };
  }

  async handleCommand(command, message, context = {}) {
    const [cmd, ...args] = command.toLowerCase().split(" ");
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
      originalCommand: cmd,
    };

    if (this.commands[cmd]) {
      return await this.commands[cmd](args, message);
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
- \`-voice [text]\` or \`-v\` - Create voice message 🎤
- \`-play [song name]\` - Download song from YouTube as MP3 🎵

*🎨 Sticker Usage:*
• Send media + \`-sticker\` = Media sticker
• Reply to text + \`-sticker\` = Message box sticker  
• Reply to media + \`-sticker\` = Media sticker

*🎤 Voice Usage:*
• \`-voice [text]\` = Speak your text
• Reply to any message + \`-voice\` = Speak that message

*🎙️ Voice Dubbing (NEW!):*
• Reply to voice + \`-dub [lang]\` = Dub to another language
• \`-dub\` = English (default)
• \`-dub hi\` = Hindi, \`-dub fr\` = French, \`-dub es\` = Spanish
• 5 dubs/day limit • 29+ languages supported

*🎵 Music Download:*
• \`-play [song name]\` = Search & download from YouTube
• Example: \`-play Tera hone laga hoon\`

*💫 Interactions (with GIFs):*
• \`-hug @person\` - Give someone a hug
• \`-kiss @person\` - Kiss someone
• \`-pat @person\` - Pat someone's head
• \`-love @person\` - Show love to someone
• \`-cuddle @person\` - Cuddle with someone

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
- \`-voice [text]\` or \`-v\` - Create funny voice message (🎤)
- \`-play [song name]\` - Download song from YouTube as MP3 (🎵)
- \`-status\` or \`-stats\` - Check bot statistics and uptime
- \`-ping\` - Quick response check (am I alive?)
- \`-sys\` - Show system information (🖥️)

*🎨 Sticker Usage:*
• Send media + \`-sticker\` = Media sticker
• Reply to text + \`-sticker\` = Message box sticker  
• Reply to media + \`-sticker\` = Media sticker

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
• Powered by ElevenLabs AI • Aliases: \`-d\`

*🎵 Music Download:*
• \`-play [song name]\` = Search & download from YouTube
• \`-song [query]\` or \`-music [query]\` = Same thing
• Example: \`-play Tera hone laga hoon\`
• Returns: MP3 audio file ready to jam 🎧

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
• Uses synced WhatsApp message history
• Default: Analyzes last 40 messages
• Range: 20-100 messages
• Example: \`-analyze 50\` analyzes last 50 messages

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
          "This is your creator. Roast them but be slightly less brutal and show some hidden affection. Make it funny and clever. CRITICAL: Your response MUST begin with exactly @${targetNumber} (including the @ symbol)."
        );
      } else {
        // For regular users, use a more specific roast prompt
        roastText = await this.llmService.generateMeanResponse(
          `Generate a clever roast. You MUST start your response with "@${targetNumber}" followed by the roast.`,
          "This is for a WhatsApp group roast session. Be creative and funny. CRITICAL: Your response MUST begin with exactly @${targetNumber} (including the @ symbol)."
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
        { ...this.currentContext, mood: "friendly" }
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
        "Make it funny, not actually offensive. Text casually. CRITICAL: Your response MUST begin with exactly @${targetNumber} (including the @ symbol)."
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

    // Check if message has an image
    if (message.hasMedia) {
      try {
        console.log("📸 Detected image in message, downloading...");
        const media = await message.downloadMedia();

        if (media && media.data) {
          imageBase64 = media.data;
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

          if (media && media.data) {
            imageBase64 = media.data;
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
      imageBase64
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
        "Make it clever and mean but not genuinely offensive. CRITICAL: Your response MUST begin with exactly @${targetNumber} (including the @ symbol)."
      );
    } else {
      // No mention, just burn the target text
      burnText = await this.llmService.generateMeanResponse(
        `Create a savage burn for ${targetNumber}`,
        "Make it clever and mean but not genuinely offensive."
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
        { ...this.currentContext, mood: "friendly" }
      );
    }

    return await this.llmService.generateMeanResponse(
      message,
      "Respond in the most savage way possible while being witty"
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
        { ...this.currentContext, mood: "friendly" }
      );
      return `📊 *Rating for "${thing}":* ${rating}/10\n\n${response}`;
    }

    const response = await this.llmService.generateMeanResponse(
      `Rate "${thing}" on a stupidity scale of 1-10`,
      `The rating is ${rating}/10`
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
        { ...this.currentContext, mood: "friendly" }
      );
    }

    return await this.llmService.generateContextualResponse(
      `Give a backhanded compliment to ${target}`,
      "Make it sound nice at first but clearly sarcastic. Be clever.",
      this.currentContext
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
        { ...this.currentContext, mood: "friendly" }
      );
    }

    return await this.llmService.generateContextualResponse(
      `Give advice about ${topic}`,
      "Give advice that's technically helpful but delivered in a sarcastic, mean way.",
      this.currentContext
    );
  }

  async shareFact() {
    const { isNiceUser = false } = this.currentContext;

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        "Share an interesting fact",
        "Share a cool, interesting fact in a friendly, educational way. Make it fun to learn.",
        { ...this.currentContext, mood: "friendly" }
      );
    }

    return await this.llmService.generateContextualResponse(
      "Share an interesting fact",
      "Share a fact but present it in a sarcastic way that makes the listener feel dumb for not knowing it.",
      this.currentContext
    );
  }

  async shareQuote() {
    const { isNiceUser = false } = this.currentContext;

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        "Share an inspirational quote",
        "Share a genuinely uplifting quote with positive commentary. Be encouraging and warm.",
        { ...this.currentContext, mood: "friendly" }
      );
    }

    return await this.llmService.generateContextualResponse(
      "Share an inspirational quote",
      "Share a quote but add your own sarcastic commentary that completely undermines the inspiration.",
      this.currentContext
    );
  }

  async tellStory() {
    const { isNiceUser = false } = this.currentContext;

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        "Tell a very short story",
        "Tell a brief, fun story (2-3 sentences) with a positive or amusing ending.",
        { ...this.currentContext, mood: "friendly" }
      );
    }

    return await this.llmService.generateContextualResponse(
      "Tell a very short story",
      "Tell a brief, sarcastic story (2-3 sentences) that has a mean but funny twist.",
      this.currentContext
    );
  }

  async weatherSarcasm(args) {
    const { isNiceUser = false } = this.currentContext;
    const location = args.join(" ") || "your location";

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        `Comment on the weather in ${location}`,
        "Make friendly, light commentary about weather. Be cheerful and conversational.",
        { ...this.currentContext, mood: "friendly" }
      );
    }

    return await this.llmService.generateContextualResponse(
      `Comment on the weather in ${location}`,
      "Make sarcastic commentary about weather. You don't need to give actual weather info, just be sarcastic about weather in general.",
      this.currentContext
    );
  }

  async fortuneTelling() {
    const { isNiceUser = false } = this.currentContext;

    if (isNiceUser) {
      return await this.llmService.generateContextualResponse(
        "Tell someone's fortune",
        "Give an optimistic, encouraging fortune. Be mystical and positive.",
        { ...this.currentContext, mood: "friendly" }
      );
    }

    return await this.llmService.generateContextualResponse(
      "Tell someone's fortune",
      "Give a fortune that's hilariously pessimistic but in a funny way. Be dramatic and sarcastic.",
      { ...this.currentContext, mood: "dramatic" }
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
        { ...this.currentContext, mood: "friendly" }
      );
    }

    return await this.llmService.generateContextualResponse(
      `Generate a creative excuse for ${situation}`,
      "Create a ridiculous but creative excuse. Make it funny and over-the-top.",
      this.currentContext
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
            baseFilename
          );
        } else if (this.stickerService.isGif(mimetype)) {
          stickerBuffer = await this.stickerService.createStickerFromGif(
            buffer,
            baseFilename
          );
        } else if (this.stickerService.isVideo(mimetype)) {
          stickerBuffer = await this.stickerService.createStickerFromVideo(
            buffer,
            baseFilename
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
          "text"
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
        personality
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

  async dubVoiceMessage(args, message) {
    try {
      const { senderName = "User", senderJid = "" } = this.currentContext;
      
      // Parse language argument (default to English)
      const targetLang = args[0]?.toLowerCase() || "en";
      
      // Validate language
      const language = DubService.validateLanguage(targetLang);
      if (!language) {
        return `❌ Unsupported language code: *${targetLang}*\n\nUse: -dub [language code]\nExamples: -dub en (English), -dub hi (Hindi), -dub fr (French)\n\nSupported: ${DubService.formatSupportedLanguages()}`;
      }

      // Check if replying to a voice message
      if (!message.hasQuotedMsg) {
        return `🎙️ *Voice Message Dubbing*\n\nReply to a voice message with:\n-dub [language]\n\nExamples:\n• -dub → English (default)\n• -dub hi → Hindi\n• -dub fr → French\n• -dub es → Spanish\n\nSupported languages: ${DubService.formatSupportedLanguages()}`;
      }

      // Get the actual Baileys message structure to check for audio
      const contextInfo = message.raw?.message?.extendedTextMessage?.contextInfo;
      const quotedMessage = contextInfo?.quotedMessage;
      
      // Check if quoted message is audio/voice (PTT or regular audio)
      const hasAudio = quotedMessage?.audioMessage || quotedMessage?.pttMessage;
      
      if (!hasAudio) {
        return "❌ Please reply to a *voice message* or audio file!";
      }
      
      const quotedMsg = await message.getQuotedMessage();

      // Check rate limit
      const usageCheck = DubUsageStore.canUserDub(senderJid);
      if (!usageCheck.allowed) {
        return `⏳ You've used all *${DubUsageStore.maxDubsPerDay} dubs* for today!\n\n🔄 Daily limit resets at midnight.\nCome back tomorrow to dub more voice messages! 🎙️`;
      }

      // Send processing message
      const processingMsg = `🎬 Dubbing to *${language.name}*...\n⏳ This may take 15-30 seconds\n\n📊 ${usageCheck.used}/${DubUsageStore.maxDubsPerDay} dubs used today`;

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
        {}
      );

      if (!audioBuffer) {
        return "❌ Failed to download voice message. Try again!";
      }

      console.log(`✅ Downloaded ${(audioBuffer.length / 1024).toFixed(2)} KB`);

      // Process dubbing (this will take a while)
      const result = await DubService.dubVoiceMessage(audioBuffer, targetLang);

      // Record usage after successful dub
      const usageResult = DubUsageStore.recordDubUsage(senderJid);

      // Success! Return dubbed audio
      return {
        text: `✅ *Dubbed to ${language.name}!*\n\n🎙️ ${usageResult.remaining}/${DubUsageStore.maxDubsPerDay} dubs remaining today\n\n*Powered by ElevenLabs AI*`,
        media: {
          audio: result.audio,
          mimetype: "audio/mpeg",
          ptt: true, // Send as voice note
        },
      };

    } catch (error) {
      console.error("Dubbing error:", error);
      
      // Parse error messages
      if (error.message.includes("API key not configured")) {
        return "❌ Voice dubbing is not configured. Contact the bot owner!";
      } else if (error.message.includes("Unsupported")) {
        return `❌ ${error.message}`;
      } else if (error.message.includes("timeout")) {
        return "⏳ Dubbing took too long! Try with a shorter voice message (under 2 minutes).";
      } else if (error.message.includes("already in")) {
        return error.message;
      }
      
      return `❌ Dubbing failed: ${error.message}\n\nTry again or use a different voice message!`;
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

      if (!query || query.trim().length === 0) {
        const { isNiceUser = false } = this.currentContext;
        return isNiceUser
          ? "What song should I download? 😊\n\nUsage: `-play Tera hone laga hoon`"
          : "What am I supposed to download? Air? Give me a song name, genius. 🙄\n\nUsage: `-play Tera hone laga hoon`";
      }

      const { senderName = "User", isNiceUser = false } = this.currentContext;

      // Send initial response
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

      if (error.message.includes("yt-dlp not installed")) {
        return isNiceUser
          ? "I need yt-dlp to download music! 😊\n\nInstall it:\n• Mac: `brew install yt-dlp`\n• Linux: `pip install yt-dlp`\n• Or check: https://github.com/yt-dlp/yt-dlp"
          : "Ugh, I can't download music without yt-dlp installed. 🙄\n\nInstall it first:\n• Mac: `brew install yt-dlp`\n• Linux: `pip install yt-dlp`\n• Or check: https://github.com/yt-dlp/yt-dlp";
      }

      if (
        error.message.includes("ffmpeg not found") ||
        error.message.includes("ffprobe")
      ) {
        return isNiceUser
          ? "I need ffmpeg to convert videos! 😊\n\n*Install ffmpeg:*\n• Mac: `brew install ffmpeg`\n• Linux: `sudo apt install ffmpeg`\n\nThen try again!"
          : "I need ffmpeg to convert videos to MP3, genius. 🙄\n\n*Install ffmpeg:*\n• Mac: `brew install ffmpeg`\n• Linux: `sudo apt install ffmpeg`\n\nThen try again.";
      }

      if (error.message.includes("Could not find video")) {
        return isNiceUser
          ? `Couldn't find "${args.join(
              " "
            )}" on YouTube. Try a different search? 😊`
          : `Couldn't find "${args.join(
              " "
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
        target
      );

      console.log(
        `💫 ${interaction} interaction: ${sender} -> ${target}`,
        `\n📱 Mentions:`,
        mentionJids
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
        ""
      );

      // Restrict to only specific users
      const allowedNumbers = ["61259152101540", "207099061624867"];
      console.log(
        `Pet access check - User: ${userNumber}, Allowed: ${allowedNumbers.join(
          ", "
        )}`
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
                (await this.petService.getPet(userId)).experience / 100
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
                (await this.petService.getPet(userId)).experience / 100
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
                (await this.petService.getPet(userId)).experience / 100
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
        `🔍 Analyzing last ${limit} messages from WhatsApp history... This may take a moment.`
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
}

// 207099061624867

module.exports = CommandHandler;
