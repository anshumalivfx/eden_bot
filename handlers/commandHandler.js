const StickerService = require("../services/stickerService");
const VoiceService = require("../services/voiceService");
const YouTubeService = require("../services/youtubeService");

class CommandHandler {
  constructor(llmService) {
    this.llmService = llmService;
    this.stickerService = new StickerService();
    this.voiceService = VoiceService;
    this.youtubeService = new YouTubeService();
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
      s2: this.createSticker.bind(this), // Short alias for sticker
      voice: this.createVoice.bind(this),
      v: this.createVoice.bind(this), // Short alias for voice
      speak: this.createVoice.bind(this),
      tts: this.createVoice.bind(this), // Text-to-speech alias
      play: this.playMusic.bind(this),
      song: this.playMusic.bind(this), // Alias for play
      music: this.playMusic.bind(this), // Alias for play
      status: this.showStatus.bind(this),
      stats: this.showStatus.bind(this), // Alias for status
      ping: this.ping.bind(this), // Quick response check
    };
  }

  async handleCommand(command, message, context = {}) {
    const [cmd, ...args] = command.toLowerCase().split(" ");
    const {
      senderName = "User",
      isOwner = false,
      mood = "sarcastic",
    } = context;

    // Add context to command execution
    this.currentContext = { senderName, isOwner, mood, message };

    if (this.commands[cmd]) {
      return await this.commands[cmd](args, message);
    } else {
      // If it's not a recognized command, treat it as a general question
      return await this.askQuestion([command], message);
    }
  }

  async showHelp() {
    const { isOwner = false, senderName = "User" } = this.currentContext;

    const ownerNote = isOwner
      ? `\n🔑 *Special Owner Commands for ${senderName}:*\nYou get slightly less mean responses! (Lucky you...)`
      : "";

    return `🤖 *Eden's Commands* (because you clearly need help)

Hi, I'm Eden - your sarcastic AI companion! 😈

*Basic Commands:*
- \`-help\` or \`-h\` - Show this pathetic list
- \`-ask [question]\` or \`-a [question]\` - Ask me anything (prepare for disappointment)
- \`-roast\` or \`-r\` - Get roasted (you asked for it)
- \`-joke\` or \`-j\` - Hear a joke (probably funnier than you)
- \`-insult [target]\` or \`-i [target]\` - Generate an insult
- \`-sarcasm [topic]\` or \`-s [topic]\` - Get sarcastic about something

*Advanced Commands:*
- \`-burn [person]\` or \`-b [person]\` - Burn someone specific
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

*🎵 Music Download:*
• \`-play [song name]\` = Search & download from YouTube
• \`-song [query]\` or \`-music [query]\` = Same thing
• Example: \`-play Tera hone laga hoon\`
• Returns: MP3 audio file ready to jam 🎧

*🎯 Mention Me:*
Say "Eden" or "@Eden" and I'll grace you with my presence. Maybe.

*Pro tip:* Just type \`-\` followed by anything and I'll roast your existence! 

I'm Eden - and yes, I'm better than you. Deal with it. 💅😈${ownerNote}`;
  }

  async roastUser(args, message) {
    try {
      const { senderName = "User", isOwner = false } = this.currentContext;

      if (isOwner) {
        return await this.llmService.generateContextualResponse(
          `Roast ${senderName} in a witty and clever way`,
          "This is your creator. Roast them but be slightly less brutal and show some hidden affection. Make it funny and clever.",
          { senderName, isOwner: true }
        );
      }

      // For regular users, use a more specific roast prompt
      return await this.llmService.generateMeanResponse(
        `Roast this person named ${senderName} in a witty, clever, and funny way. Make it a proper roast - clever insults and sarcastic humor.`,
        "This is for a WhatsApp group roast session. Be creative and funny with your roasts."
      );
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
    return await this.llmService.generateJoke();
  }

  async generateInsult(args) {
    const target = args.join(" ") || "you";
    return await this.llmService.generateInsult(target);
  }

  async generateSarcasm(args) {
    const topic = args.join(" ") || "everything";
    return await this.llmService.generateSarcasm(topic);
  }

  async askQuestion(args, message) {
    const question = args.join(" ");
    if (!question) {
      return "Oh great, you want to ask a question but forgot to actually ask it. Brilliant. 🙄";
    }

    return await this.llmService.generateMeanResponse(
      question,
      "Answer this question in a mean, sarcastic way but still be somewhat helpful"
    );
  }

  async burnSomeone(args) {
    const target = args.join(" ");
    if (!target) {
      return "You want me to burn someone but didn't tell me who? Your brain must be on vacation. 🔥";
    }

    return await this.llmService.generateMeanResponse(
      `Create a savage burn for ${target}`,
      "Make it clever and mean but not genuinely offensive"
    );
  }

  async savageMode(args) {
    const message = args.join(" ");
    if (!message) {
      return "Savage mode activated, but you gave me nothing to work with. Peak intelligence right there. 😤";
    }

    return await this.llmService.generateMeanResponse(
      message,
      "Respond in the most savage way possible while being witty"
    );
  }

  async rateStupidity(args) {
    const thing = args.join(" ");
    if (!thing) {
      return "You want me to rate something's stupidity but didn't tell me what? I'll rate your request: 10/10 for irony. 📊";
    }

    const rating = Math.floor(Math.random() * 10) + 1;
    const response = await this.llmService.generateMeanResponse(
      `Rate "${thing}" on a stupidity scale of 1-10`,
      `The rating is ${rating}/10`
    );

    return `📊 *Stupidity Rating for "${thing}":* ${rating}/10\n\n${response}`;
  }

  async checkMood() {
    const { mood = "sarcastic", senderName = "User" } = this.currentContext;
    const moodEmojis = {
      sarcastic: "🙄",
      savage: "😈",
      playful: "😏",
      annoyed: "😤",
      dramatic: "🎭",
    };

    return `${moodEmojis[mood]} I'm currently feeling **${mood}**, ${senderName}. Hope that helps you calibrate your expectations.`;
  }

  async fakeCompliment(args) {
    const target = args.join(" ") || this.currentContext.senderName || "you";
    return await this.llmService.generateContextualResponse(
      `Give a backhanded compliment to ${target}`,
      "Make it sound nice at first but clearly sarcastic. Be clever.",
      this.currentContext
    );
  }

  async giveAdvice(args) {
    const topic = args.join(" ");
    if (!topic) {
      return "You want advice but didn't tell me about what? Here's free advice: be more specific. 🤦‍♀️";
    }

    return await this.llmService.generateContextualResponse(
      `Give advice about ${topic}`,
      "Give advice that's technically helpful but delivered in a sarcastic, mean way.",
      this.currentContext
    );
  }

  async shareFact() {
    return await this.llmService.generateContextualResponse(
      "Share an interesting fact",
      "Share a fact but present it in a sarcastic way that makes the listener feel dumb for not knowing it.",
      this.currentContext
    );
  }

  async shareQuote() {
    return await this.llmService.generateContextualResponse(
      "Share an inspirational quote",
      "Share a quote but add your own sarcastic commentary that completely undermines the inspiration.",
      this.currentContext
    );
  }

  async tellStory() {
    return await this.llmService.generateContextualResponse(
      "Tell a very short story",
      "Tell a brief, sarcastic story (2-3 sentences) that has a mean but funny twist.",
      this.currentContext
    );
  }

  async weatherSarcasm(args) {
    const location = args.join(" ") || "your location";
    return await this.llmService.generateContextualResponse(
      `Comment on the weather in ${location}`,
      "Make sarcastic commentary about weather. You don't need to give actual weather info, just be sarcastic about weather in general.",
      this.currentContext
    );
  }

  async fortuneTelling() {
    return await this.llmService.generateContextualResponse(
      "Tell someone's fortune",
      "Give a fortune that's hilariously pessimistic but in a funny way. Be dramatic and sarcastic.",
      { ...this.currentContext, mood: "dramatic" }
    );
  }

  async generateExcuse(args) {
    const situation = args.join(" ");
    if (!situation) {
      return "You want an excuse but won't tell me for what? Here's one: 'I was too lazy to be specific.' 🤷‍♀️";
    }

    return await this.llmService.generateContextualResponse(
      `Generate a creative excuse for ${situation}`,
      "Create a ridiculous but creative excuse. Make it funny and over-the-top.",
      this.currentContext
    );
  }

  async createSticker(args, message) {
    const { senderName = "User" } = this.currentContext;

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
        await message.reply(
          "🎨 Eden is begrudgingly processing your media into a sticker... This better be worth it."
        );

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

        // Create and send media sticker
        const { MessageMedia } = require("whatsapp-web.js");
        const stickerMedia = new MessageMedia(
          "image/webp",
          stickerBuffer.toString("base64"),
          "sticker.webp"
        );

        await message.reply(stickerMedia, undefined, {
          sendMediaAsSticker: true,
        });
        return this.stickerService.getRandomStickerQuote();
      } else if (targetMessage.body && targetMessage.body.trim()) {
        // Create text sticker from message content
        await message.reply(
          "💬 Eden is reluctantly turning your words into a sticker... This better be quotable."
        );

        const messageText = targetMessage.body.trim();
        const quoteSender = isReply
          ? await this.getMessageSenderName(targetMessage)
          : senderName;

        const stickerBuffer = await this.stickerService.createTextSticker(
          messageText,
          quoteSender,
          "text"
        );

        // Create and send text sticker
        const { MessageMedia } = require("whatsapp-web.js");
        const stickerMedia = new MessageMedia(
          "image/webp",
          stickerBuffer.toString("base64"),
          "text_sticker.webp"
        );

        await message.reply(stickerMedia, undefined, {
          sendMediaAsSticker: true,
        });
        return this.stickerService.getRandomTextStickerQuote();
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
          return "I can't speak non-text messages, genius. Reply to a TEXT message! 🙄";
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
        return "What am I supposed to say? Air? Give me some actual text! 💨";
      }

      // Get random sassy response
      const responses = this.voiceService.getVoiceResponses();
      const response = responses[Math.floor(Math.random() * responses.length)];

      // Create the voice message
      const voiceResult = await this.voiceService.createFunnyVoice(
        textToSpeak,
        personality
      );

      // Send the audio file
      const { MessageMedia } = require("whatsapp-web.js");
      const fs = require("fs");

      const audioData = fs.readFileSync(voiceResult.filepath);
      const media = new MessageMedia(
        "audio/mpeg",
        audioData.toString("base64"),
        `eden_voice_${Date.now()}.mp3`
      );

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
        media: media,
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
    const errorResponses = [
      "Well, that didn't work. Your text broke my voice box. Congratulations! 🎤💥",
      "Voice generation failed. Maybe try with something less ear-torturing? 🙉",
      "I tried to speak your message, but my vocal cords rebelled. They have standards. 😤",
      "Audio creation failed. Even my TTS engine thinks your text is questionable. 🤖",
      "Something went wrong with the voice generation. Probably for the best. 🔇",
    ];

    return errorResponses[Math.floor(Math.random() * errorResponses.length)];
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
      status += `🧠 *LLM Provider:* ${process.env.GROQ_API_KEY ? 'Groq (Free)' : 'Fallback'}\n`;
      status += `💬 *Command Prefix:* -\n`;
      status += `🎭 *Features:*\n`;
      status += `   • Name Triggers: ${bot.triggerNames.join(', ')}\n`;
      status += `   • Mood System: ${bot.enableMoodSystem ? 'Active' : 'Disabled'}\n`;
      status += `   • Random Messages: ${bot.enableRandomMessages ? 'Active' : 'Disabled'}\n`;
      status += `   • Smart Context: ${bot.enableSmartContext ? 'Active' : 'Disabled'}\n`;
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

  async playMusic(args, message) {
    try {
      const query = args.join(" ");
      
      if (!query || query.trim().length === 0) {
        return "What am I supposed to download? Air? Give me a song name, genius. 🙄\n\nUsage: `-play Tera hone laga hoon`";
      }

      const { senderName = "User" } = this.currentContext;

      // Send initial response
      await message.reply(
        `🔍 Fine, searching for "${query}"... This better be worth my time.`
      );

      // Search and download
      const result = await this.youtubeService.searchAndDownload(query);

      // Create media message
      const { MessageMedia } = require("whatsapp-web.js");
      const fs = require("fs");

      const audioData = fs.readFileSync(result.filepath);
      const audioMedia = new MessageMedia(
        "audio/mpeg",
        audioData.toString("base64"),
        `${result.title}.mp3`
      );

      const sassyQuote = this.youtubeService.getRandomYouTubeQuote();
      
      // Send thumbnail if available
      if (result.thumbnail && result.thumbnail.filepath) {
        try {
          const thumbnailData = fs.readFileSync(result.thumbnail.filepath);
          const thumbnailMedia = new MessageMedia(
            "image/jpeg",
            thumbnailData.toString("base64"),
            "thumbnail.jpg"
          );

          // Send thumbnail with caption
          await message.reply(thumbnailMedia, undefined, {
            caption: `🎵 *${result.title}*\n\n${sassyQuote}`,
          });

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
        media: audioMedia,
      };
    } catch (error) {
      console.error("Play music error:", error);

      if (error.message.includes("yt-dlp not installed")) {
        return "Ugh, I can't download music without yt-dlp installed. 🙄\n\nInstall it first:\n• Mac: `brew install yt-dlp`\n• Linux: `pip install yt-dlp`\n• Or check: https://github.com/yt-dlp/yt-dlp";
      }

      if (error.message.includes("ffmpeg not found") || error.message.includes("ffprobe")) {
        return "I need ffmpeg to convert videos to MP3, genius. 🙄\n\n*Install ffmpeg:*\n• Mac: `brew install ffmpeg`\n• Linux: `sudo apt install ffmpeg`\n\nThen try again.";
      }

      if (error.message.includes("Could not find video")) {
        return `Couldn't find "${args.join(" ")}" on YouTube. Maybe try spelling it correctly? 🤔`;
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
}

module.exports = CommandHandler;
