const gtts = require("gtts");
const fs = require("fs");
const path = require("path");

class VoiceService {
  constructor() {
    this.voicePersonalities = {
      sarcastic: {
        speed: 0.8,
        pitch: -2,
        lang: "en",
        prefix: "Oh wow, let me read this earth-shattering message for you...",
        suffix: "...There, happy now?",
      },
      dramatic: {
        speed: 0.6,
        pitch: 3,
        lang: "en",
        prefix: "And now, presenting... in all its glory...",
        suffix: "...What a masterpiece of human communication!",
      },
      robot: {
        speed: 1.2,
        pitch: -5,
        lang: "en",
        prefix: "BEEP BOOP. PROCESSING HUMAN NONSENSE...",
        suffix: "...END OF TRANSMISSION. BEEP BOOP.",
      },
      posh: {
        speed: 0.7,
        pitch: 2,
        lang: "en",
        prefix: "Allow me to recite this rather... pedestrian message...",
        suffix: "...How delightfully ordinary.",
      },
      excited: {
        speed: 1.4,
        pitch: 4,
        lang: "en",
        prefix: "OMG OMG OMG! Listen to this AMAZING message!",
        suffix: "Wasn't that just... INCREDIBLE?!",
      },
      sleepy: {
        speed: 0.5,
        pitch: -3,
        lang: "en",
        prefix: "*yawn* Oh... do I really have to read this boring thing?",
        suffix: "*sigh* Can I go back to sleep now?",
      },
    };
  }

  /**
   * Convert text to speech with Eden's funny personalities
   */
  async createFunnyVoice(text, personality = null) {
    try {
      // Choose random personality if none specified
      if (!personality) {
        const personalities = Object.keys(this.voicePersonalities);
        personality =
          personalities[Math.floor(Math.random() * personalities.length)];
      }

      const voice =
        this.voicePersonalities[personality] ||
        this.voicePersonalities.sarcastic;

      // Clean and prepare text
      const cleanText = this.prepareText(text);
      const fullText = `${voice.prefix} ${cleanText} ${voice.suffix}`;

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `voice_${timestamp}.mp3`;
      const filepath = path.join(__dirname, "../temp", filename);

      // Ensure temp directory exists
      const tempDir = path.dirname(filepath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Create TTS
      const tts = new gtts(fullText, voice.lang);

      return new Promise((resolve, reject) => {
        tts.save(filepath, (err) => {
          if (err) {
            console.error("TTS Error:", err);
            reject(err);
            return;
          }

          resolve({
            filepath,
            personality,
            originalText: text,
            voiceText: fullText,
            cleanup: () => {
              try {
                if (fs.existsSync(filepath)) {
                  fs.unlinkSync(filepath);
                }
              } catch (e) {
                console.warn("Failed to cleanup voice file:", e.message);
              }
            },
          });
        });
      });
    } catch (error) {
      console.error("Voice generation error:", error);
      throw error;
    }
  }

  /**
   * Clean and prepare text for TTS
   */
  prepareText(text) {
    // Remove URLs
    let cleanText = text.replace(/https?:\/\/[^\s]+/g, "link");

    // Replace emojis with words
    const emojiMap = {
      "😂": "laughing emoji",
      "😭": "crying emoji",
      "🔥": "fire emoji",
      "💯": "one hundred emoji",
      "❤️": "heart emoji",
      "😍": "heart eyes emoji",
      "🙄": "eye roll emoji",
      "🤔": "thinking emoji",
      "😎": "cool emoji",
      "🤣": "rolling on floor laughing",
      "😏": "smirking emoji",
      "😤": "huffing emoji",
      "🙃": "upside down face",
      "😑": "expressionless face",
    };

    // Replace emojis
    for (const [emoji, word] of Object.entries(emojiMap)) {
      cleanText = cleanText.replace(new RegExp(emoji, "g"), word);
    }

    // Replace remaining emojis with generic text
    cleanText = cleanText.replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
      "emoji"
    );

    // Clean special characters but keep punctuation
    cleanText = cleanText.replace(/[^\w\s.,!?;:'"()-]/g, "");

    // Limit length for TTS
    if (cleanText.length > 200) {
      cleanText = cleanText.substring(0, 197) + "...";
    }

    return cleanText.trim() || "empty message";
  }

  /**
   * Get list of available voice personalities
   */
  getVoicePersonalities() {
    return Object.keys(this.voicePersonalities).map((key) => ({
      name: key,
      description: this.getPersonalityDescription(key),
    }));
  }

  /**
   * Get description for a personality
   */
  getPersonalityDescription(personality) {
    const descriptions = {
      sarcastic: "🙄 Peak sarcasm and eye-rolling",
      dramatic: "🎭 Over-the-top theatrical delivery",
      robot: "🤖 Mechanical beeps and boops",
      posh: "🎩 Fancy British aristocrat vibes",
      excited: "🎉 Hyperactive enthusiasm overdose",
      sleepy: "😴 Extremely bored and tired",
    };
    return descriptions[personality] || "🎪 Mystery personality";
  }

  /**
   * Get Eden's sassy responses for voice commands
   */
  getVoiceResponses() {
    return [
      "🎤 Fine, I'll make this boring message sound interesting... somehow.",
      "🗣️ Oh great, now I'm a voice actor too? The things I do for you people...",
      "🎵 Preparing to butcher your message with my magnificent voice...",
      "📢 Hold on, let me find my dramatic reading voice... *clears throat*",
      "🎪 Time for the Eden voice show! Featuring: your mediocre message!",
      "🎙️ Broadcasting your thoughts in glorious audio form... you're welcome.",
      "🗯️ Converting text to sound waves... because apparently reading is too hard.",
      "🎬 And the Academy Award for Best Dramatic Reading goes to... ME!",
    ];
  }
}

module.exports = new VoiceService();
