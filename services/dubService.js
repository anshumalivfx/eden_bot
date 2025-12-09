const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
require("dotenv").config();

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class DubService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseUrl = "https://api.elevenlabs.io/v1";
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
   * Create a dubbing project
   * @param {string} audioFilePath - Path to audio file
   * @param {string} targetLang - Target language code (e.g., 'hi', 'es')
   * @param {string} sourceLang - Source language code (default: 'auto')
   * @returns {Promise<{dubbing_id: string, expected_duration_sec: number}>}
   */
  async createDubbing(audioFilePath, targetLang, sourceLang = "auto") {
    try {
      if (!this.apiKey || this.apiKey === "your_elevenlabs_api_key_here") {
        throw new Error(
          "ElevenLabs API key not configured. Add ELEVENLABS_API_KEY to .env file"
        );
      }

      // Validate target language
      const targetLanguage = this.validateLanguage(targetLang);
      if (!targetLanguage) {
        throw new Error(
          `Unsupported target language: ${targetLang}. Use language codes like: en, hi, es, fr, de, ja, ko, ar, pt, ru, it, zh`
        );
      }

      // Create form data
      const form = new FormData();
      form.append("file", fs.createReadStream(audioFilePath));
      form.append("target_lang", targetLanguage.code);
      form.append("source_lang", sourceLang);
      form.append("mode", "automatic");
      form.append("num_speakers", "0"); // Auto-detect speakers
      form.append("watermark", "true"); // Required for free tier

      console.log(
        `🎬 Creating dubbing project: auto → ${targetLanguage.name}`
      );

      const response = await axios.post(`${this.baseUrl}/dubbing`, form, {
        headers: {
          "xi-api-key": this.apiKey,
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      console.log(
        `✅ Dubbing project created: ${response.data.dubbing_id} (expected: ${response.data.expected_duration_sec}s)`
      );

      return response.data;
    } catch (error) {
      console.error("Error creating dubbing:", error.response?.data || error);
      throw new Error(
        error.response?.data?.detail?.message ||
          error.message ||
          "Failed to create dubbing project"
      );
    }
  }

  /**
   * Check dubbing status
   * @param {string} dubbingId - Dubbing project ID
   * @returns {Promise<{status: string, target_languages: string[], error?: string}>}
   */
  async getDubbingStatus(dubbingId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/dubbing/${dubbingId}`,
        {
          headers: {
            "xi-api-key": this.apiKey,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Error checking dubbing status:",
        error.response?.data || error
      );
      throw new Error("Failed to check dubbing status");
    }
  }

  /**
   * Wait for dubbing to complete with polling
   * @param {string} dubbingId - Dubbing project ID
   * @param {number} maxWaitTime - Maximum wait time in milliseconds (default: 120000 = 2 minutes)
   * @returns {Promise<{status: string, target_languages: string[]}>}
   */
  async waitForDubbing(dubbingId, maxWaitTime = 120000) {
    const startTime = Date.now();
    const pollInterval = 3000; // Check every 3 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getDubbingStatus(dubbingId);

      console.log(`⏳ Dubbing status: ${status.status}`);

      if (status.status === "dubbed") {
        console.log("✅ Dubbing complete!");
        return status;
      } else if (status.status === "failed") {
        throw new Error(
          `Dubbing failed: ${status.error || "Unknown error"}`
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error("Dubbing timeout - took too long to complete");
  }

  /**
   * Download dubbed audio file
   * @param {string} dubbingId - Dubbing project ID
   * @param {string} targetLang - Target language code
   * @returns {Promise<Buffer>} - Audio buffer
   */
  async downloadDubbedAudio(dubbingId, targetLang) {
    try {
      // ElevenLabs download endpoint format
      const downloadUrl = `${this.baseUrl}/dubbing/${dubbingId}/audio/${targetLang}`;

      console.log(`📥 Downloading dubbed audio: ${downloadUrl}`);

      const response = await axios.get(downloadUrl, {
        headers: {
          "xi-api-key": this.apiKey,
        },
        responseType: "arraybuffer",
      });

      console.log(
        `✅ Downloaded ${(response.data.length / 1024).toFixed(2)} KB`
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error(
        "Error downloading dubbed audio:",
        error.response?.data || error
      );
      throw new Error("Failed to download dubbed audio");
    }
  }

  /**
   * Main dubbing workflow
   * @param {Buffer} audioBuffer - Original audio buffer
   * @param {string} targetLang - Target language code
   * @returns {Promise<{audio: Buffer, sourceLanguage: string, targetLanguage: string}>}
   */
  async dubVoiceMessage(audioBuffer, targetLang) {
    let convertedFilePath = null;

    try {
      // Step 1: Convert audio to compatible format
      console.log("🔄 Converting audio format...");
      convertedFilePath = await this.convertAudioFormat(audioBuffer, "mp3");

      // Step 2: Create dubbing project
      const dubbing = await this.createDubbing(convertedFilePath, targetLang);

      // Step 3: Wait for dubbing to complete
      const status = await this.waitForDubbing(dubbing.dubbing_id);

      // Step 4: Download dubbed audio
      const dubbedAudio = await this.downloadDubbedAudio(
        dubbing.dubbing_id,
        targetLang
      );

      return {
        audio: dubbedAudio,
        sourceLanguage: status.source_language || "auto",
        targetLanguage: targetLang,
        dubbingId: dubbing.dubbing_id,
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
