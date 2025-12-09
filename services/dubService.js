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
    this.piperPath = path.join(__dirname, "../piper/piper/piper");
    this.modelsPath = path.join(__dirname, "../piper-models");
    this.tempDir = path.join(__dirname, "../temp");

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Language code mapping (ISO 639-1)
    this.languageMap = {
      en: { name: "English", code: "en" },
      hi: { name: "Hindi", code: "hi" },
      es: { name: "Spanish", code: "es" },
      fr: { name: "French", code: "fr" },
      de: { name: "German", code: "de" },
      it: { name: "Italian", code: "it" },
      pt: { name: "Portuguese", code: "pt" },
      ru: { name: "Russian", code: "ru" },
      ja: { name: "Japanese", code: "ja" },
      ko: { name: "Korean", code: "ko" },
      zh: { name: "Chinese", code: "zh" },
      ar: { name: "Arabic", code: "ar" },
      tr: { name: "Turkish", code: "tr" },
      pl: { name: "Polish", code: "pl" },
      nl: { name: "Dutch", code: "nl" },
      sv: { name: "Swedish", code: "sv" },
      da: { name: "Danish", code: "da" },
      fi: { name: "Finnish", code: "fi" },
      no: { name: "Norwegian", code: "no" },
      cs: { name: "Czech", code: "cs" },
      el: { name: "Greek", code: "el" },
      hu: { name: "Hungarian", code: "hu" },
      ro: { name: "Romanian", code: "ro" },
      uk: { name: "Ukrainian", code: "uk" },
      id: { name: "Indonesian", code: "id" },
      ms: { name: "Malay", code: "ms" },
      th: { name: "Thai", code: "th" },
      vi: { name: "Vietnamese", code: "vi" },
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
      hi: "hi_IN-ravidas-medium",
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
   * Generate speech using Piper TTS
   * @param {string} text - Text to speak
   * @param {string} langCode - Language code
   * @returns {Promise<Buffer>} - Audio buffer
   */
  async generateSpeech(text, langCode) {
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
      const outputPath = path.join(this.tempDir, `speech_${timestamp}.wav`);

      // Run Piper TTS
      const command = `echo "${text.replace(/"/g, '\\"')}" | ${this.piperPath} -m ${modelPath} -c ${configPath} -f ${outputPath}`;
      
      await execAsync(command);

      // Check if file was created
      if (!fs.existsSync(outputPath)) {
        throw new Error("Speech generation failed - file not created");
      }

      const stats = fs.statSync(outputPath);
      console.log(`✅ Generated ${(stats.size / 1024).toFixed(2)} KB speech`);

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
   * Main dubbing workflow with Piper TTS
   * @param {Buffer} audioBuffer - Original audio buffer
   * @param {string} targetLang - Target language code
   * @returns {Promise<{audio: Buffer, sourceLanguage: string, targetLanguage: string}>}
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
      const speech = await this.generateSpeech(translatedText, targetLang);

      return {
        filepath: speech.filepath,
        cleanup: speech.cleanup,
        sourceLanguage: transcription.language,
        targetLanguage: targetLang,
        originalText: transcription.text,
        translatedText: translatedText,
      };
    } finally {
      // Clean up converted file
      if (convertedFilePath && fs.existsSync(convertedFilePath)) {
        try {
          fs.unlinkSync(convertedFilePath);
        } catch (e) {
          console.warn("Failed to clean up converted file:", e.message);
        }
      }
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
