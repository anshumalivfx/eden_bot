const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const Groq = require("groq-sdk");
const googleTranslate = require("@vitalets/google-translate-api");
require("dotenv").config();

const execAsync = promisify(exec);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class DubService {
  constructor() {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    // TTS Engine Selection (set in .env)
    // Options: "piper" (free, local) or "elevenlabs" (paid, cloud)
    this.ttsEngine = process.env.DUB_TTS_ENGINE || "piper";
    
    // ElevenLabs API setup
    this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    this.elevenLabsBaseUrl = "https://api.elevenlabs.io/v1";
    
    // Piper TTS setup
    this.piperPath = path.join(__dirname, "../piper/piper/piper");
    this.modelsPath = path.join(__dirname, "../piper-models");
    this.tempDir = path.join(__dirname, "../temp");

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    console.log(`🎙️ Dub Service initialized with TTS Engine: ${this.ttsEngine.toUpperCase()}`);

    // Language code mapping (ISO 639-1) with country flags
    this.languageMap = {
      en: { name: "English", code: "en", flag: "🇺🇸" },
      hi: { name: "Hindi", code: "hi", flag: "🇮🇳" },
      es: { name: "Spanish", code: "es", flag: "🇪🇸" },
      fr: { name: "French", code: "fr", flag: "🇫🇷" },
      de: { name: "German", code: "de", flag: "🇩🇪" },
      it: { name: "Italian", code: "it", flag: "🇮🇹" },
      pt: { name: "Portuguese", code: "pt", flag: "🇧🇷" },
      ru: { name: "Russian", code: "ru", flag: "🇷🇺" },
      ja: { name: "Japanese", code: "ja", flag: "🇯🇵" },
      ko: { name: "Korean", code: "ko", flag: "🇰🇷" },
      zh: { name: "Chinese", code: "zh", flag: "🇨🇳" },
      ar: { name: "Arabic", code: "ar", flag: "🇸🇦" },
      tr: { name: "Turkish", code: "tr", flag: "🇹🇷" },
      pl: { name: "Polish", code: "pl", flag: "🇵🇱" },
      nl: { name: "Dutch", code: "nl", flag: "🇳🇱" },
      sv: { name: "Swedish", code: "sv", flag: "🇸🇪" },
      da: { name: "Danish", code: "da", flag: "🇩🇰" },
      fi: { name: "Finnish", code: "fi", flag: "🇫🇮" },
      no: { name: "Norwegian", code: "no", flag: "🇳🇴" },
      cs: { name: "Czech", code: "cs", flag: "🇨🇿" },
      el: { name: "Greek", code: "el", flag: "🇬🇷" },
      hu: { name: "Hungarian", code: "hu", flag: "🇭🇺" },
      ro: { name: "Romanian", code: "ro", flag: "🇷🇴" },
      uk: { name: "Ukrainian", code: "uk", flag: "🇺🇦" },
      id: { name: "Indonesian", code: "id", flag: "🇮🇩" },
      ms: { name: "Malay", code: "ms", flag: "🇲🇾" },
      th: { name: "Thai", code: "th", flag: "🇹🇭" },
      vi: { name: "Vietnamese", code: "vi", flag: "🇻🇳" },
    };
  }

  /**
   * Validate language code
   */
  validateLanguage(langCode) {
    const code = langCode?.toLowerCase();
    if (!code || !this.languageMap[code]) {
      return null;
    }
    return this.languageMap[code];
  }

  /**
   * Get language name from code
   */
  getLanguageName(langCode) {
    const lang = this.validateLanguage(langCode);
    return lang ? lang.name : "Unknown";
  }

  /**
   * Convert audio to supported format for ElevenLabs
   * @param {Buffer} audioBuffer - Input audio buffer
   * @param {string} outputFormat - Desired format (mp3, wav)
   * @returns {Promise<string>} - Path to converted file
   */
  async convertAudioFormat(audioBuffer, outputFormat = "mp3") {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const inputPath = path.join(this.tempDir, `input_${timestamp}.ogg`);
      const outputPath = path.join(
        this.tempDir,
        `converted_${timestamp}.${outputFormat}`
      );

      // Write buffer to temporary file
      fs.writeFileSync(inputPath, audioBuffer);

      ffmpeg(inputPath)
        .toFormat(outputFormat)
        .audioCodec(outputFormat === "mp3" ? "libmp3lame" : "pcm_s16le")
        .audioChannels(1) // Mono
        .audioFrequency(44100) // 44.1kHz
        .on("end", () => {
          // Clean up input file
          try {
            fs.unlinkSync(inputPath);
          } catch (e) {
            console.warn("Failed to clean up input file:", e.message);
          }
          resolve(outputPath);
        })
        .on("error", (err) => {
          // Clean up files on error
          try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          } catch (e) {
            console.warn("Failed to clean up files:", e.message);
          }
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Piper voice model mapping for different languages
   */
  getPiperModel(langCode) {
    const models = {
      en: "en_US-lessac-medium",
      hi: "hi_IN-rohan-medium",
      es: "es_ES-davefx-medium",
      fr: "fr_FR-siwis-medium",
      de: "de_DE-thorsten-medium",
      it: "it_IT-riccardo-x_low",
      pt: "pt_BR-faber-medium",
      ru: "ru_RU-dmitri-medium",
      ja: "ja_JP-natasha-medium",
      ko: "ko_KR-keonhee-x_low",
      zh: "zh_CN-huayan-medium",
      ar: "ar_JO-kareem-medium",
      tr: "tr_TR-fettah-medium",
      pl: "pl_PL-darkman-medium",
      nl: "nl_NL-mls-medium",
      sv: "sv_SE-nst-medium",
      da: "da_DK-talesyntese-medium",
      fi: "fi_FI-harri-medium",
      no: "no_NO-talesyntese-medium",
      cs: "cs_CZ-jirka-medium",
      el: "el_GR-rapunzelina-low",
      hu: "hu_HU-anna-medium",
      ro: "ro_RO-mihai-medium",
      uk: "uk_UA-ukrainian_tts-medium",
      id: "id_ID-fitra-medium",
      ms: "ms_MY-yasmin-medium",
      th: "th_TH-kmutt-medium",
      vi: "vi_VN-25hours-single-low",
    };
    return models[langCode] || models["en"];
  }

  /**
   * Transcribe audio to text using Groq Whisper
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<{text: string, language: string}>}
   */
  async transcribeAudio(audioFilePath) {
    try {
      console.log("🎤 Transcribing audio with Groq Whisper...");
      
      const transcription = await this.groq.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: "whisper-large-v3",
        response_format: "verbose_json",
      });

      console.log(`✅ Transcribed: "${transcription.text.substring(0, 50)}..." (${transcription.language})`);
      
      return {
        text: transcription.text,
        language: transcription.language,
      };
    } catch (error) {
      console.error("Error transcribing audio:", error);
      throw new Error("Failed to transcribe audio");
    }
  }

  /**
   * Translate text using free Google Translate API
   * @param {string} text - Text to translate
   * @param {string} targetLang - Target language code
   * @returns {Promise<string>} - Translated text
   */
  async translateText(text, targetLang) {
    try {
      console.log(`🌐 Translating to ${targetLang}...`);
      
      const result = await googleTranslate.translate(text, { to: targetLang });
      
      console.log(`✅ Translated: "${result.text.substring(0, 50)}..."`);
      
      return result.text;
    } catch (error) {
      console.error("Error translating text:", error);
      throw new Error("Failed to translate text");
    }
  }

  /**
   * Generate speech using ElevenLabs Voice Cloning (Speech-to-Speech)
   * This preserves the original speaker's voice characteristics
   */
  async generateSpeechElevenLabs(text, langCode, originalAudioPath) {
    try {
      console.log(`🗣️ Generating cloned speech with ElevenLabs...`);
      
      // Use ElevenLabs Speech-to-Speech API for voice cloning
      // This takes the original audio and generates new speech that preserves voice characteristics
      const FormData = require('form-data');
      const form = new FormData();
      
      form.append('text', text);
      form.append('model_id', 'eleven_multilingual_sts_v2'); // Speech-to-Speech model
      form.append('audio', fs.createReadStream(originalAudioPath));
      
      // Voice settings for cloning
      const voiceSettings = {
        stability: 0.5,
        similarity_boost: 0.8,
        use_speaker_boost: true
      };
      form.append('voice_settings', JSON.stringify(voiceSettings));

      const url = `${this.elevenLabsBaseUrl}/speech-to-speech/stream`;

      const response = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          "xi-api-key": this.elevenLabsApiKey,
        },
        responseType: "arraybuffer",
      });

      const timestamp = Date.now();
      const outputPath = path.join(this.tempDir, `speech_${timestamp}.mp3`);
      
      fs.writeFileSync(outputPath, response.data);
      
      const stats = fs.statSync(outputPath);
      console.log(`✅ Generated cloned speech: ${(stats.size / 1024).toFixed(2)} KB`);

      return {
        filepath: outputPath,
        cleanup: () => {
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
            console.log(`🗑️ Cleaned up: ${outputPath}`);
          }
        }
      };
    } catch (error) {
      console.error("ElevenLabs error:", error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        throw new Error("Invalid ElevenLabs API key");
      } else if (error.response?.status === 429) {
        throw new Error("ElevenLabs rate limit exceeded");
      } else if (error.response?.status === 400) {
        throw new Error("Voice cloning failed - audio may be too short or poor quality");
      }
      
      throw new Error(`ElevenLabs voice cloning failed: ${error.message}`);
    }
  }

  /**
   * Generate speech using Piper TTS (local)
   * @param {string} text - Text to speak
   * @param {string} langCode - Language code
   * @returns {Promise<{filepath: string, cleanup: Function}>}
   */
  async generateSpeechPiper(text, langCode) {
    try {
      const model = this.getPiperModel(langCode);
      const modelPath = path.join(this.modelsPath, `${model}.onnx`);
      const configPath = path.join(this.modelsPath, `${model}.onnx.json`);
      
      // Check if Piper binary exists and is executable
      if (!fs.existsSync(this.piperPath)) {
        throw new Error(
          `Piper binary not found at ${this.piperPath}. Run setup-piper.sh to install.`
        );
      }

      // Check if model exists
      if (!fs.existsSync(modelPath)) {
        throw new Error(
          `Piper model not found: ${model}. Run setup-piper.sh to download models.`
        );
      }

      console.log(`🗣️ Generating speech with Piper (${model})...`);

      const timestamp = Date.now();
      const wavPath = path.join(this.tempDir, `speech_${timestamp}.wav`);
      const oggPath = path.join(this.tempDir, `speech_${timestamp}.ogg`);

      // Run Piper TTS to generate WAV
      const command = `echo "${text.replace(/"/g, '\\"')}" | ${this.piperPath} -m ${modelPath} -c ${configPath} -f ${wavPath}`;
      
      await execAsync(command);

      // Check if WAV file was created
      if (!fs.existsSync(wavPath)) {
        throw new Error("Speech generation failed - file not created");
      }

      console.log(`✅ Generated WAV speech`);

      // Convert WAV to OGG (Opus) for WhatsApp compatibility
      console.log(`🔄 Converting to OGG...`);
      
      await new Promise((resolve, reject) => {
        ffmpeg(wavPath)
          .toFormat('ogg')
          .audioCodec('libopus')
          .audioChannels(1)
          .audioFrequency(16000) // 16kHz for voice
          .audioBitrate('32k')
          .on('end', () => {
            console.log(`✅ Converted to OGG`);
            resolve();
          })
          .on('error', (err) => {
            reject(new Error(`FFmpeg conversion failed: ${err.message}`));
          })
          .save(oggPath);
      });

      // Clean up WAV file
      if (fs.existsSync(wavPath)) {
        fs.unlinkSync(wavPath);
      }

      const stats = fs.statSync(oggPath);
      console.log(`✅ Final audio: ${(stats.size / 1024).toFixed(2)} KB`);

      return {
        filepath: oggPath,
        cleanup: () => {
          if (fs.existsSync(oggPath)) {
            fs.unlinkSync(oggPath);
            console.log(`🗑️ Cleaned up: ${oggPath}`);
          }
        }
      };
    } catch (error) {
      console.error("Error generating speech:", error);
      
      // Provide helpful error message for permission denied
      if (error.message.includes("Permission denied")) {
        throw new Error(
          `Piper binary not executable. Run: chmod +x piper/piper`
        );
      }
      
      throw new Error(`Failed to generate speech: ${error.message}`);
    }
  }

  /**
   * Generate speech using selected TTS engine
   * @param {string} text - Text to speak
   * @param {string} langCode - Language code
   * @param {string} originalAudioPath - Path to original audio (for ElevenLabs voice cloning)
   * @returns {Promise<{filepath: string, cleanup: Function}>}
   */
  async generateSpeech(text, langCode, originalAudioPath = null) {
    if (this.ttsEngine === "elevenlabs") {
      if (!originalAudioPath) {
        throw new Error("Original audio path required for ElevenLabs voice cloning");
      }
      return await this.generateSpeechElevenLabs(text, langCode, originalAudioPath);
    } else {
      return await this.generateSpeechPiper(text, langCode);
    }
  }

  /**
   * Main dubbing workflow
   * @param {Buffer} audioBuffer - Original audio buffer
   * @param {string} targetLang - Target language code
   * @returns {Promise<{filepath: string, cleanup: Function, sourceLanguage: string, targetLanguage: string, originalText: string, translatedText: string}>}
   */
  async dubVoiceMessage(audioBuffer, targetLang) {
    let convertedFilePath = null;

    try {
      // Step 1: Convert audio to WAV for Whisper
      console.log("🔄 Converting audio format...");
      convertedFilePath = await this.convertAudioFormat(audioBuffer, "wav");

      // Step 2: Transcribe audio to text
      const transcription = await this.transcribeAudio(convertedFilePath);

      // Step 3: Translate text to target language
      const translatedText = await this.translateText(
        transcription.text,
        targetLang
      );

      // Step 4: Generate speech in target language
      // Pass original audio path for ElevenLabs voice cloning
      const speech = await this.generateSpeech(translatedText, targetLang, convertedFilePath);

      return {
        filepath: speech.filepath,
        cleanup: () => {
          // Cleanup both generated speech and converted file
          speech.cleanup();
          if (convertedFilePath && fs.existsSync(convertedFilePath)) {
            try {
              fs.unlinkSync(convertedFilePath);
              console.log(`🗑️ Cleaned up: ${convertedFilePath}`);
            } catch (e) {
              console.warn("Failed to clean up converted file:", e.message);
            }
          }
        },
        sourceLanguage: transcription.language,
        targetLanguage: targetLang,
        originalText: transcription.text,
        translatedText: translatedText,
      };
    } catch (error) {
      // Clean up on error
      if (convertedFilePath && fs.existsSync(convertedFilePath)) {
        try {
          fs.unlinkSync(convertedFilePath);
        } catch (e) {
          console.warn("Failed to clean up converted file:", e.message);
        }
      }
      throw error;
    }
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages() {
    return Object.entries(this.languageMap).map(([code, info]) => ({
      code,
      name: info.name,
    }));
  }

  /**
   * Format supported languages for help message
   */
  formatSupportedLanguages() {
    const langs = this.getSupportedLanguages();
    return langs
      .map((l) => `${l.code} (${l.name})`)
      .join(", ")
      .substring(0, 200);
  }
}

module.exports = new DubService();
