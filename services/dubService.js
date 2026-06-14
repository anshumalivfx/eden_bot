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
    // Options: "piper" (free, local), "elevenlabs" (paid, cloud), or "asynclabs" (paid, cloud)
    this.ttsEngine = process.env.DUB_TTS_ENGINE || "piper";

    // Transcription Engine Selection (set in .env)
    // Options: "whisper-local" (on-device, unlimited) or "groq" (cloud, fast)
    this.transcriptionEngine =
      process.env.DUB_TRANSCRIPTION_ENGINE || "whisper-local";

    // Python path (auto-detect venv or use system python3)
    this.pythonPath = process.env.PYTHON_PATH || this.detectPythonPath();

    // ElevenLabs API setup
    this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    this.elevenLabsBaseUrl = "https://api.elevenlabs.io/v1";

    // Async Labs API setup
    this.asyncLabsApiKey = process.env.ASYNCLABS_API_KEY;
    this.asyncLabsBaseUrl = "https://api.async.ai";

    // Piper TTS setup
    this.piperPath = path.join(__dirname, "../piper/piper/piper");
    this.modelsPath = path.join(__dirname, "../piper-models");
    this.tempDir = path.join(__dirname, "../temp");

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    console.log(`🎙️ Dub Service initialized:`);
    console.log(`   📢 TTS Engine: ${this.ttsEngine.toUpperCase()}`);
    console.log(
      `   🎤 Transcription: ${this.transcriptionEngine.toUpperCase()}`,
    );
    console.log(`   🐍 Python Path: ${this.pythonPath}`);

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
        `converted_${timestamp}.${outputFormat}`,
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
   * Async Labs voice ID mapping for different languages
   * Using Async's pre-built multilingual voices
   */
  getAsyncLabsVoiceId(langCode) {
    const voiceIds = {
      en: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Default English voice
      hi: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Multilingual voice supports Hindi
      es: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Spanish
      fr: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // French
      de: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // German
      it: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Italian
      pt: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Portuguese
      ru: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Russian
      ja: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Japanese
      ko: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Korean
      zh: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Chinese
      ar: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Arabic
      tr: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Turkish
      pl: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Polish
      nl: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Dutch
      sv: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Swedish
      da: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Danish
      fi: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Finnish
      no: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Norwegian
      cs: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Czech
      el: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Greek
      hu: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Hungarian
      ro: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Romanian
      uk: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Ukrainian
      id: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Indonesian
      ms: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Malay
      th: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Thai
      vi: "e0f39dc4-f691-4e78-bba5-5c636692cc04", // Vietnamese
    };
    return voiceIds[langCode] || voiceIds["en"];
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
   * Natural-sounding female ("pretty girl") neural voice per language for
   * Edge TTS (Microsoft's free online neural voices - no API key needed).
   */
  getEdgeVoice(langCode) {
    // Natural female ("pretty girl") neural voice for every language Edge TTS
    // supports - so Eden can voice-reply in whatever language was spoken.
    const voices = {
      af: "af-ZA-AdriNeural",
      am: "am-ET-MekdesNeural",
      ar: "ar-EG-SalmaNeural",
      az: "az-AZ-BanuNeural",
      bg: "bg-BG-KalinaNeural",
      bn: "bn-IN-TanishaaNeural",
      bs: "bs-BA-VesnaNeural",
      ca: "ca-ES-JoanaNeural",
      cs: "cs-CZ-VlastaNeural",
      cy: "cy-GB-NiaNeural",
      da: "da-DK-ChristelNeural",
      de: "de-DE-KatjaNeural",
      el: "el-GR-AthinaNeural",
      en: "en-US-JennyNeural",
      es: "es-ES-ElviraNeural",
      et: "et-EE-AnuNeural",
      fa: "fa-IR-DilaraNeural",
      fi: "fi-FI-NooraNeural",
      fil: "fil-PH-BlessicaNeural",
      fr: "fr-FR-DeniseNeural",
      ga: "ga-IE-OrlaNeural",
      gl: "gl-ES-SabelaNeural",
      gu: "gu-IN-DhwaniNeural",
      he: "he-IL-HilaNeural",
      hi: "hi-IN-SwaraNeural",
      hr: "hr-HR-GabrijelaNeural",
      hu: "hu-HU-NoemiNeural",
      id: "id-ID-GadisNeural",
      is: "is-IS-GudrunNeural",
      it: "it-IT-ElsaNeural",
      iu: "iu-Latn-CA-SiqiniqNeural",
      ja: "ja-JP-NanamiNeural",
      jv: "jv-ID-SitiNeural",
      jw: "jv-ID-SitiNeural", // Whisper uses "jw" for Javanese
      ka: "ka-GE-EkaNeural",
      kk: "kk-KZ-AigulNeural",
      km: "km-KH-SreymomNeural",
      kn: "kn-IN-SapnaNeural",
      ko: "ko-KR-SunHiNeural",
      lo: "lo-LA-KeomanyNeural",
      lt: "lt-LT-OnaNeural",
      lv: "lv-LV-EveritaNeural",
      mk: "mk-MK-MarijaNeural",
      ml: "ml-IN-SobhanaNeural",
      mn: "mn-MN-YesuiNeural",
      mr: "mr-IN-AarohiNeural",
      ms: "ms-MY-YasminNeural",
      mt: "mt-MT-GraceNeural",
      my: "my-MM-NilarNeural",
      nb: "nb-NO-PernilleNeural",
      ne: "ne-NP-HemkalaNeural",
      nl: "nl-NL-ColetteNeural",
      no: "nb-NO-PernilleNeural", // Whisper uses "no" for Norwegian
      pl: "pl-PL-ZofiaNeural",
      ps: "ps-AF-LatifaNeural",
      pt: "pt-BR-FranciscaNeural",
      ro: "ro-RO-AlinaNeural",
      ru: "ru-RU-SvetlanaNeural",
      si: "si-LK-ThiliniNeural",
      sk: "sk-SK-ViktoriaNeural",
      sl: "sl-SI-PetraNeural",
      so: "so-SO-UbaxNeural",
      sq: "sq-AL-AnilaNeural",
      sr: "sr-RS-SophieNeural",
      su: "su-ID-TutiNeural",
      sv: "sv-SE-SofieNeural",
      sw: "sw-KE-ZuriNeural",
      ta: "ta-IN-PallaviNeural",
      te: "te-IN-ShrutiNeural",
      th: "th-TH-PremwadeeNeural",
      tr: "tr-TR-EmelNeural",
      uk: "uk-UA-PolinaNeural",
      ur: "ur-PK-UzmaNeural",
      uz: "uz-UZ-MadinaNeural",
      vi: "vi-VN-HoaiMyNeural",
      zh: "zh-CN-XiaoxiaoNeural",
      zu: "zu-ZA-ThandoNeural",
    };

    // Whisper (esp. Groq verbose_json) returns full language NAMES like
    // "english"/"urdu" rather than ISO codes - map those to codes too.
    const nameToCode = {
      english: "en", spanish: "es", french: "fr", german: "de",
      italian: "it", portuguese: "pt", russian: "ru", japanese: "ja",
      korean: "ko", chinese: "zh", mandarin: "zh", cantonese: "zh",
      arabic: "ar", hindi: "hi", urdu: "ur", bengali: "bn", punjabi: "pa",
      turkish: "tr", polish: "pl", dutch: "nl", flemish: "nl", swedish: "sv",
      danish: "da", finnish: "fi", norwegian: "no", czech: "cs", greek: "el",
      hungarian: "hu", romanian: "ro", ukrainian: "uk", indonesian: "id",
      malay: "ms", thai: "th", vietnamese: "vi", tamil: "ta", telugu: "te",
      hebrew: "he", persian: "fa", farsi: "fa", pashto: "ps", swahili: "sw",
      tagalog: "fil", filipino: "fil", afrikaans: "af", albanian: "sq",
      amharic: "am", armenian: "hy", azerbaijani: "az", basque: "eu",
      belarusian: "be", bosnian: "bs", bulgarian: "bg", catalan: "ca",
      croatian: "hr", estonian: "et", galician: "gl", georgian: "ka",
      gujarati: "gu", icelandic: "is", javanese: "jv", kannada: "kn",
      kazakh: "kk", khmer: "km", lao: "lo", latvian: "lv", lithuanian: "lt",
      macedonian: "mk", malayalam: "ml", maltese: "mt", marathi: "mr",
      mongolian: "mn", myanmar: "my", burmese: "my", nepali: "ne",
      serbian: "sr", sinhala: "si", slovak: "sk", slovenian: "sl",
      somali: "so", sundanese: "su", uzbek: "uz", welsh: "cy", zulu: "zu",
    };

    let raw = String(langCode || "en").toLowerCase().trim();
    if (nameToCode[raw]) raw = nameToCode[raw];

    // Normalize: strip region (e.g. "en-US" -> "en"); keep 3-letter "fil"
    const code = raw.split(/[-_]/)[0];
    return voices[raw] || voices[code] || voices["en"];
  }

  /**
   * Generate a natural female voice note using Edge TTS (free, no API key).
   * Falls back to local Piper TTS if Edge TTS is unavailable (e.g. offline).
   * @param {string} text - Text to speak (already cleaned of emojis/actions)
   * @param {string} langCode - ISO-639-1 language code
   * @returns {Promise<{filepath: string, cleanup: Function}>}
   */
  async generateNaturalVoice(text, langCode = "en") {
    try {
      return await this.generateSpeechEdgeTTS(text, langCode);
    } catch (error) {
      console.warn(
        `⚠️ Edge TTS failed (${error.message}), falling back to Piper...`,
      );
      return await this.generateSpeechPiper(text, langCode);
    }
  }

  /**
   * Generate speech with Microsoft Edge's free neural TTS voices.
   * @returns {Promise<{filepath: string, cleanup: Function}>}
   */
  async generateSpeechEdgeTTS(text, langCode = "en") {
    const { EdgeTTS } = require("node-edge-tts");

    const voice = this.getEdgeVoice(langCode);
    // Locale is the first two segments of the voice id (e.g. ur-PK-Uzma... -> ur-PK)
    const lang = voice.split("-").slice(0, 2).join("-");

    console.log(`🗣️ Generating natural voice with Edge TTS (${voice})...`);

    const timestamp = Date.now();
    const mp3Path = path.join(this.tempDir, `edge_${timestamp}.mp3`);
    const oggPath = path.join(this.tempDir, `edge_${timestamp}.ogg`);

    const tts = new EdgeTTS({
      voice,
      lang,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      rate: "default",
      pitch: "default",
      volume: "default",
    });

    await tts.ttsPromise(text, mp3Path);

    if (!fs.existsSync(mp3Path)) {
      throw new Error("Edge TTS produced no audio file");
    }

    // Convert MP3 -> OGG (Opus) so WhatsApp shows it as a proper voice note
    await new Promise((resolve, reject) => {
      ffmpeg(mp3Path)
        .toFormat("ogg")
        .audioCodec("libopus")
        .audioChannels(1)
        .audioFrequency(48000)
        .audioBitrate("48k")
        .on("end", resolve)
        .on("error", (err) =>
          reject(new Error(`FFmpeg conversion failed: ${err.message}`)),
        )
        .save(oggPath);
    });

    // Clean up intermediate mp3
    try {
      fs.unlinkSync(mp3Path);
    } catch (e) {}

    console.log(`✅ Edge TTS voice note ready`);

    return {
      filepath: oggPath,
      cleanup: () => {
        if (fs.existsSync(oggPath)) {
          try {
            fs.unlinkSync(oggPath);
          } catch (e) {}
        }
      },
    };
  }

  /**
   * Transcribe audio to text using selected engine
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<{text: string, language: string}>}
   */
  async transcribeAudio(audioFilePath, options = {}) {
    // options.language - ISO-639-1 hint (e.g. "hi", "es") to greatly improve
    //   accuracy for non-English audio. When omitted, the model auto-detects.
    const { language = null } = options;

    // Check audio duration to decide engine
    const duration = await this.getAudioDuration(audioFilePath);
    const durationMinutes = Math.floor(duration / 60);

    console.log(
      `🎤 Audio duration: ${durationMinutes}m ${Math.floor(duration % 60)}s`,
    );

    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const forceLocal = this.transcriptionEngine === "whisper-local";

    // Prefer Groq Whisper large-v3 (free + far better multilingual accuracy)
    // whenever a key is available and the file isn't too long for the API.
    // Fall back to on-device Whisper for very long files or if forced local.
    if (hasGroqKey && !forceLocal && duration <= 600) {
      console.log(`☁️ Using Groq Whisper large-v3 (cloud, multilingual)`);
      return await this.transcribeWithGroq(audioFilePath, language);
    }

    console.log(`📍 Using on-device Whisper (unlimited, no API limits)`);
    return await this.transcribeWithWhisperLocal(audioFilePath, language);
  }

  /**
   * Translate spoken audio directly to English using Groq Whisper's
   * translation task. This is far more reliable for non-English speech than
   * transcribing (often inaccurately) then running text translation.
   * Returns { text, language } or null if it couldn't translate.
   */
  async translateAudioToEnglish(audioFilePath) {
    if (!process.env.GROQ_API_KEY) return null;
    try {
      console.log("🌐 Translating audio → English with Groq Whisper...");
      const translation = await this.groq.audio.translations.create({
        file: fs.createReadStream(audioFilePath),
        model: "whisper-large-v3",
        response_format: "json",
      });

      const text = translation?.text?.trim();
      if (!text) return null;

      console.log(`✅ Audio translated to English: "${text.substring(0, 50)}..."`);
      return { text, language: "en" };
    } catch (error) {
      console.error("❌ Groq audio translation failed:", error.message);
      return null;
    }
  }

  /**
   * Get audio duration in seconds
   */
  async getAudioDuration(audioFilePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
        if (err) {
          console.warn("Failed to get audio duration, using local Whisper");
          resolve(9999); // Assume long file if probe fails
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  /**
   * Detect Python path (check for venv first, then system python3)
   */
  detectPythonPath() {
    // Common venv locations
    const venvPaths = [
      path.join(process.cwd(), "venv/bin/python3"),
      path.join(process.cwd(), "venv/bin/python"),
      path.join(process.cwd(), ".venv/bin/python3"),
      path.join(process.cwd(), ".venv/bin/python"),
      "/home/pi/venv/bin/python3",
      "/home/pi/.venv/bin/python3",
    ];

    // Check if any venv python exists
    for (const venvPath of venvPaths) {
      if (fs.existsSync(venvPath)) {
        return venvPath;
      }
    }

    // Fallback to system python3
    return "python3";
  }

  /**
   * Transcribe using Groq Whisper (cloud, fast but limited)
   */
  async transcribeWithGroq(audioFilePath, language = null) {
    try {
      console.log(
        `☁️ Transcribing with Groq Whisper${
          language ? ` (language hint: ${language})` : ""
        }...`,
      );

      const params = {
        file: fs.createReadStream(audioFilePath),
        model: "whisper-large-v3",
        response_format: "verbose_json",
      };
      // Passing the language hint when known dramatically improves accuracy
      // and prevents wrong-language auto-detection on short clips.
      if (language) {
        params.language = language;
      }

      const transcription = await this.groq.audio.transcriptions.create(params);

      console.log(
        `✅ Transcribed: "${transcription.text.substring(0, 50)}..." (${
          transcription.language
        })`,
      );

      return {
        text: transcription.text,
        language: transcription.language,
      };
    } catch (error) {
      console.error("❌ Groq transcription failed:", error.message);
      console.log("🔄 Falling back to local Whisper...");
      return await this.transcribeWithWhisperLocal(audioFilePath, language);
    }
  }

  /**
   * Transcribe using local OpenAI Whisper (on-device, unlimited)
   */
  async transcribeWithWhisperLocal(audioFilePath, language = null) {
    try {
      // The 'tiny' model is very inaccurate for non-English audio. Default to
      // 'base' (still light) for much better multilingual results; allow
      // override via WHISPER_MODEL for low-power devices (e.g. "tiny") or
      // higher accuracy ("small"/"medium").
      const whisperModel = process.env.WHISPER_MODEL || "base";

      console.log(
        `🖥️ Transcribing with local Whisper (faster-whisper, model: ${whisperModel}${
          language ? `, language: ${language}` : ""
        })...`,
      );

      // Convert to WAV format for better compatibility
      const wavPath = audioFilePath.replace(/\.[^.]+$/, "_temp.wav");
      await this.convertToWav(audioFilePath, wavPath);

      // Build a language argument for the Python call when a hint is provided
      const langArg = language ? `, language='${language}'` : "";

      // Run faster-whisper via Python
      const command = `${this.pythonPath} -c "from faster_whisper import WhisperModel; import json; model = WhisperModel('${whisperModel}', device='cpu', compute_type='int8'); segments, info = model.transcribe('${wavPath}', beam_size=5${langArg}); text = ' '.join([segment.text for segment in segments]); print(json.dumps({'text': text, 'language': info.language}))"`;

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for long transcriptions
      });

      if (stderr && !stderr.includes("FP16")) {
        console.warn("Whisper warnings:", stderr);
      }

      const result = JSON.parse(stdout.trim());

      // Cleanup temp file
      try {
        fs.unlinkSync(wavPath);
      } catch (e) {}

      console.log(
        `✅ Transcribed: "${result.text.substring(0, 50)}..." (${result.language})`,
      );

      return {
        text: result.text,
        language: result.language,
      };
    } catch (error) {
      console.error("❌ Local Whisper transcription failed:", error.message);

      // If Whisper is not installed, provide helpful message
      if (error.message.includes("No module named 'faster_whisper'")) {
        throw new Error(
          "faster-whisper not installed. Install with: pip3 install faster-whisper",
        );
      }

      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Convert audio to WAV format
   */
  async convertToWav(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat("wav")
        .audioFrequency(16000) // Whisper works best with 16kHz
        .audioChannels(1) // Mono
        .on("end", () => resolve(outputPath))
        .on("error", reject)
        .save(outputPath);
    });
  }

  /**
   * Translate text using free Google Translate API
   * @param {string} text - Text to translate
   * @param {string} targetLang - Target language code
   * @returns {Promise<string>} - Translated text
   */
  async translateText(text, targetLang) {
    try {
      console.log(`🌐 Translating from auto-detect to ${targetLang}...`);
      console.log(`   Original: "${text.substring(0, 100)}..."`);

      const result = await googleTranslate.translate(text, { to: targetLang });

      console.log(`   Translated: "${result.text.substring(0, 100)}..."`);
      console.log(`   ✅ Translation complete`);

      // Verify translation happened (text should change unless already in target language)
      if (result.text.trim() === text.trim()) {
        console.warn(
          `⚠️ Translation returned same text - might already be in ${targetLang}`,
        );
      }

      return result.text;
    } catch (error) {
      console.error("Error translating text:", error);
      throw new Error(`Failed to translate text: ${error.message}`);
    }
  }

  /**
   * Create dubbing project with ElevenLabs Dubbing API
   * This API automatically dubs audio to another language with voice cloning
   * Available on FREE tier!
   */
  async generateSpeechElevenLabs(text, langCode, originalAudioPath) {
    try {
      console.log(
        `🗣️ Creating dubbing with ElevenLabs (with voice cloning)...`,
      );

      const FormData = require("form-data");
      const form = new FormData();

      // Upload the source audio file
      form.append("file", fs.createReadStream(originalAudioPath));
      form.append("target_lang", langCode); // Target language code
      form.append("mode", "automatic"); // Automatic dubbing mode
      form.append("num_speakers", 1); // Single speaker
      form.append("watermark", "true"); // Accept watermark (free tier)

      // Step 1: Create dubbing project
      const createUrl = `${this.elevenLabsBaseUrl}/dubbing`;

      console.log(`📤 Uploading audio for dubbing...`);
      const createResponse = await axios.post(createUrl, form, {
        headers: {
          ...form.getHeaders(),
          "xi-api-key": this.elevenLabsApiKey,
        },
      });

      const dubbingId = createResponse.data.dubbing_id;
      console.log(`✅ Dubbing project created: ${dubbingId}`);

      // Step 2: Poll for completion
      console.log(`⏳ Waiting for dubbing to complete...`);
      const metadataUrl = `${this.elevenLabsBaseUrl}/dubbing/${dubbingId}`;

      let attempts = 0;
      const maxAttempts = 60; // 60 attempts = 5 minutes max

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

        const statusResponse = await axios.get(metadataUrl, {
          headers: {
            "xi-api-key": this.elevenLabsApiKey,
          },
        });

        const status = statusResponse.data.status;
        console.log(`📊 Dubbing status: ${status}`);

        if (status === "dubbed") {
          // Step 3: Download the dubbed audio
          console.log(`⬇️ Downloading dubbed audio...`);
          const audioUrl = `${this.elevenLabsBaseUrl}/dubbing/${dubbingId}/audio/${langCode}`;

          const audioResponse = await axios.get(audioUrl, {
            headers: {
              "xi-api-key": this.elevenLabsApiKey,
            },
            responseType: "arraybuffer",
          });

          const timestamp = Date.now();
          const mp3Path = path.join(this.tempDir, `speech_${timestamp}.mp3`);
          const oggPath = path.join(this.tempDir, `speech_${timestamp}.ogg`);

          fs.writeFileSync(mp3Path, audioResponse.data);

          console.log(`🔄 Converting ElevenLabs MP3 to OGG for WhatsApp...`);

          await new Promise((resolve, reject) => {
            ffmpeg(mp3Path)
              .toFormat("ogg")
              .audioCodec("libopus")
              .audioChannels(1)
              .audioFrequency(16000)
              .audioBitrate("32k")
              .on("end", () => {
                try {
                  fs.unlinkSync(mp3Path);
                } catch (e) {}
                console.log(`✅ Converted to OGG`);
                resolve();
              })
              .on("error", (err) => {
                try {
                  if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                  if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
                } catch (e) {}
                reject(new Error(`FFmpeg conversion failed: ${err.message}`));
              })
              .save(oggPath);
          });

          const stats = fs.statSync(oggPath);
          console.log(
            `✅ Downloaded dubbed audio: ${(stats.size / 1024).toFixed(2)} KB`,
          );

          return {
            filepath: oggPath,
            cleanup: () => {
              if (fs.existsSync(oggPath)) {
                fs.unlinkSync(oggPath);
                console.log(`🗑️ Cleaned up: ${oggPath}`);
              }
              if (fs.existsSync(mp3Path)) {
                fs.unlinkSync(mp3Path);
                console.log(`🗑️ Cleaned up: ${mp3Path}`);
              }
            },
          };
        } else if (status === "dubbing_failed") {
          throw new Error("Dubbing failed on ElevenLabs server");
        }

        attempts++;
      }

      throw new Error("Dubbing timeout - took too long to complete");
    } catch (error) {
      console.error(
        "ElevenLabs dubbing error:",
        error.response?.data || error.message,
      );

      if (error.response?.status === 401) {
        throw new Error("Invalid ElevenLabs API key");
      } else if (error.response?.status === 429) {
        throw new Error("ElevenLabs rate limit exceeded");
      } else if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.detail?.message || "Bad request";
        throw new Error(`Dubbing failed: ${errorMsg}`);
      }

      throw new Error(`ElevenLabs dubbing failed: ${error.message}`);
    }
  }

  /**
   * Create instant voice clone and generate speech with Async Labs
   * @param {string} text - Text to speak
   * @param {string} langCode - Target language code
   * @param {string} originalAudioPath - Path to original audio for voice cloning
   * @returns {Promise<{filepath: string, cleanup: Function}>}
   */
  async generateSpeechAsyncLabs(text, langCode, originalAudioPath) {
    let trimmedAudioPath = null;
    let voiceId = null;
    let usedCloning = false;

    try {
      console.log(`🗣️ Dubbing with Async Labs...`);

      // Try voice cloning if original audio is provided
      if (originalAudioPath) {
        try {
          // Step 1: Extract first 5 seconds of audio for cloning
          console.log(`✂️ Extracting first 5 seconds for voice cloning...`);
          const timestamp = Date.now();
          trimmedAudioPath = path.join(
            this.tempDir,
            `clone_sample_${timestamp}.wav`,
          );

          await new Promise((resolve, reject) => {
            ffmpeg(originalAudioPath)
              .setDuration(5) // Only first 5 seconds
              .toFormat("wav")
              .on("end", () => {
                console.log(`✅ Extracted 5-second sample`);
                resolve();
              })
              .on("error", (err) => {
                reject(new Error(`Audio trimming failed: ${err.message}`));
              })
              .save(trimmedAudioPath);
          });

          // Step 2: Create voice clone from 5-second sample
          console.log(`📤 Creating voice clone from 5-second sample...`);

          const FormData = require("form-data");
          const form = new FormData();
          form.append("audio", fs.createReadStream(trimmedAudioPath));
          form.append("name", `clone_${timestamp}`);

          const cloneResponse = await axios.post(
            `${this.asyncLabsBaseUrl}/voices/clone`,
            form,
            {
              headers: {
                ...form.getHeaders(),
                "x-api-key": this.asyncLabsApiKey,
                version: "v1",
              },
            },
          );

          voiceId = cloneResponse.data.id;
          usedCloning = true;
          console.log(`✅ Voice cloned successfully: ${voiceId}`);

          // Clean up trimmed audio sample
          if (fs.existsSync(trimmedAudioPath)) {
            fs.unlinkSync(trimmedAudioPath);
            trimmedAudioPath = null;
          }
        } catch (cloneError) {
          // Clean up on clone failure
          if (trimmedAudioPath && fs.existsSync(trimmedAudioPath)) {
            try {
              fs.unlinkSync(trimmedAudioPath);
              trimmedAudioPath = null;
            } catch (e) {}
          }

          // Check if it's a quota/limit error
          if (
            cloneError.response?.data?.detail?.error_code ===
            "VOICE_CLONE_LIMIT_EXCEEDED"
          ) {
            console.warn(
              `⚠️ Voice cloning limit exceeded. Falling back to default voice.`,
            );
            voiceId = this.getAsyncLabsVoiceId(langCode);
          } else {
            // Re-throw other errors
            throw cloneError;
          }
        }
      } else {
        // No original audio, use default voice
        voiceId = this.getAsyncLabsVoiceId(langCode);
      }

      // Step 3: Generate speech with voice (cloned or default)
      if (usedCloning) {
        console.log(`🎵 Generating speech with cloned voice: ${voiceId}`);
      } else {
        console.log(`🎵 Generating speech with default voice: ${voiceId}`);
      }

      const ttsTimestamp = Date.now();
      const ttsResponse = await axios.post(
        `${this.asyncLabsBaseUrl}/text_to_speech/streaming`,
        {
          model_id: "asyncflow_v2.0",
          transcript: text,
          voice: {
            mode: "id",
            id: voiceId,
          },
          output_format: {
            container: "raw",
            encoding: "pcm_s16le",
            sample_rate: 44100,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.asyncLabsApiKey,
            version: "v1",
          },
          responseType: "arraybuffer",
        },
      );

      // Step 3: Convert raw PCM to OGG for WhatsApp
      const rawPath = path.join(this.tempDir, `speech_${ttsTimestamp}.raw`);
      const oggPath = path.join(this.tempDir, `speech_${ttsTimestamp}.ogg`);

      // Write raw PCM data
      fs.writeFileSync(rawPath, ttsResponse.data);

      console.log(`🔄 Converting to OGG for WhatsApp...`);

      // Convert PCM to OGG using ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(rawPath)
          .inputFormat("s16le")
          .inputOptions(["-ar 44100", "-ac 1"]) // 44.1kHz, mono
          .toFormat("ogg")
          .audioCodec("libopus")
          .audioChannels(1)
          .audioFrequency(16000) // 16kHz for voice
          .audioBitrate("32k")
          .on("end", () => {
            console.log(`✅ Converted to OGG`);
            // Clean up raw file
            try {
              fs.unlinkSync(rawPath);
            } catch (e) {}
            resolve();
          })
          .on("error", (err) => {
            reject(new Error(`FFmpeg conversion failed: ${err.message}`));
          })
          .save(oggPath);
      });

      const stats = fs.statSync(oggPath);
      console.log(
        `✅ Generated cloned speech: ${(stats.size / 1024).toFixed(2)} KB`,
      );

      return {
        filepath: oggPath,
        cleanup: () => {
          if (fs.existsSync(oggPath)) {
            fs.unlinkSync(oggPath);
            console.log(`🗑️ Cleaned up: ${oggPath}`);
          }
        },
      };
    } catch (error) {
      // Clean up trimmed audio if it still exists
      if (trimmedAudioPath && fs.existsSync(trimmedAudioPath)) {
        try {
          fs.unlinkSync(trimmedAudioPath);
        } catch (e) {}
      }

      console.error(
        "Async Labs TTS error:",
        error.response?.data || error.message,
      );

      if (error.response?.status === 401) {
        throw new Error("Invalid Async Labs API key");
      } else if (error.response?.status === 429) {
        throw new Error("Async Labs rate limit exceeded");
      } else if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.detail?.message || "Bad request";
        throw new Error(`Async Labs TTS failed: ${errorMsg}`);
      }

      throw new Error(`Async Labs TTS failed: ${error.message}`);
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
          `Piper binary not found at ${this.piperPath}. Run setup-piper.sh to install.`,
        );
      }

      // Check if model exists
      if (!fs.existsSync(modelPath)) {
        throw new Error(
          `Piper model not found: ${model}. Run setup-piper.sh to download models.`,
        );
      }

      console.log(`🗣️ Generating speech with Piper (${model})...`);

      const timestamp = Date.now();
      const wavPath = path.join(this.tempDir, `speech_${timestamp}.wav`);
      const oggPath = path.join(this.tempDir, `speech_${timestamp}.ogg`);

      const piperDir = path.dirname(this.piperPath);
      const uniquePaths = (paths) => [...new Set(paths.filter(Boolean))];

      // Ensure Piper can locate runtime libs on macOS (notably libespeak-ng.1.dylib).
      const dynLibPaths = uniquePaths([
        process.env.DYLD_LIBRARY_PATH,
        process.env.DYLD_FALLBACK_LIBRARY_PATH,
        piperDir,
        path.join(piperDir, "lib"),
        "/opt/homebrew/opt/espeak-ng/lib",
        "/usr/local/opt/espeak-ng/lib",
        "/opt/homebrew/lib",
        "/usr/local/lib",
      ]);

      const linuxLibPaths = uniquePaths([
        process.env.LD_LIBRARY_PATH,
        piperDir,
        path.join(piperDir, "lib"),
        "/usr/lib",
        "/usr/local/lib",
      ]);

      const piperEnv = {
        ...process.env,
        DYLD_LIBRARY_PATH: dynLibPaths.join(":"),
        DYLD_FALLBACK_LIBRARY_PATH: dynLibPaths.join(":"),
        LD_LIBRARY_PATH: linuxLibPaths.join(":"),
      };

      // Run Piper TTS to generate WAV
      const command = `echo "${text.replace(/"/g, '\\"')}" | ${
        this.piperPath
      } -m ${modelPath} -c ${configPath} -f ${wavPath}`;

      await execAsync(command, { env: piperEnv, maxBuffer: 10 * 1024 * 1024 });

      // Check if WAV file was created
      if (!fs.existsSync(wavPath)) {
        throw new Error("Speech generation failed - file not created");
      }

      console.log(`✅ Generated WAV speech`);

      // Convert WAV to OGG (Opus) for WhatsApp compatibility
      console.log(`🔄 Converting to OGG...`);

      await new Promise((resolve, reject) => {
        ffmpeg(wavPath)
          .toFormat("ogg")
          .audioCodec("libopus")
          .audioChannels(1)
          .audioFrequency(16000) // 16kHz for voice
          .audioBitrate("32k")
          .on("end", () => {
            console.log(`✅ Converted to OGG`);
            resolve();
          })
          .on("error", (err) => {
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
        },
      };
    } catch (error) {
      console.error("Error generating speech:", error);

      // Provide helpful error message for permission denied
      if (error.message.includes("Permission denied")) {
        throw new Error(
          `Piper binary not executable. Run: chmod +x piper/piper`,
        );
      }

      if (
        error.message.includes("libespeak-ng.1.dylib") ||
        error.message.includes("Library not loaded")
      ) {
        throw new Error(
          "Piper runtime library missing (libespeak-ng). Install it with: brew install espeak-ng, then restart the bot.",
        );
      }

      if (error.message.includes("incompatible architecture")) {
        throw new Error(
          "Piper binary architecture does not match installed libraries. Re-run ./setup-piper.sh in a native terminal (not Rosetta), then restart the bot.",
        );
      }

      throw new Error(`Failed to generate speech: ${error.message}`);
    }
  }

  /**
   * Generate speech using selected TTS engine
   * @param {string} text - Text to speak
   * @param {string} langCode - Language code
   * @param {string} originalAudioPath - Path to original audio (for voice cloning)
   * @returns {Promise<{filepath: string, cleanup: Function}>}
   */
  async generateSpeech(text, langCode, originalAudioPath = null) {
    if (this.ttsEngine === "elevenlabs") {
      if (!originalAudioPath) {
        throw new Error(
          "Original audio path required for ElevenLabs voice cloning",
        );
      }
      return await this.generateSpeechElevenLabs(
        text,
        langCode,
        originalAudioPath,
      );
    } else if (this.ttsEngine === "asynclabs") {
      if (!originalAudioPath) {
        throw new Error(
          "Original audio path required for Async Labs voice cloning",
        );
      }
      return await this.generateSpeechAsyncLabs(
        text,
        langCode,
        originalAudioPath,
      );
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
      // Step 1: Convert audio to appropriate format
      console.log("🔄 Converting audio format...");
      const formatForEngine = this.ttsEngine === "elevenlabs" ? "mp3" : "wav";
      convertedFilePath = await this.convertAudioFormat(
        audioBuffer,
        formatForEngine,
      );

      if (this.ttsEngine === "elevenlabs") {
        // ElevenLabs Dubbing API handles everything: transcription, translation, and dubbing with voice cloning
        console.log(
          "🎬 Using ElevenLabs Dubbing API (includes voice cloning)...",
        );

        const speech = await this.generateSpeechElevenLabs(
          null, // Not needed - ElevenLabs does transcription internally
          targetLang,
          convertedFilePath,
        );

        return {
          filepath: speech.filepath,
          cleanup: () => {
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
          sourceLanguage: "auto", // ElevenLabs auto-detects
          targetLanguage: targetLang,
          originalText: "(auto-transcribed by ElevenLabs)",
          translatedText: "(auto-translated by ElevenLabs)",
        };
      } else if (this.ttsEngine === "asynclabs") {
        // Async Labs workflow: Manual transcription → translation → TTS with voice cloning
        console.log(
          "🎬 Using Async Labs (transcribe → translate → voice clone + TTS)...",
        );

        // Step 2: Transcribe audio to text
        const transcription = await this.transcribeAudio(convertedFilePath);
        console.log(
          `📝 Transcribed (${transcription.language}): "${transcription.text.substring(0, 100)}..."`,
        );

        // Step 3: Translate text to target language
        const translatedText = await this.translateText(
          transcription.text,
          targetLang,
        );
        console.log(
          `🌐 Translated to ${targetLang}: "${translatedText.substring(0, 100)}..."`,
        );

        // Check if source and target languages are supported by Async Labs
        const asyncLabsSupportedLangs = [
          "en",
          "en-US",
          "fr",
          "de",
          "it",
          "es",
          "es-419",
          "es-LATAM",
          "pt",
          "ar",
          "ru",
          "ro",
          "ja",
          "he",
          "hy",
          "tr",
          "hi",
          "zh",
          "cmn",
        ];
        const normalizedTargetLang = targetLang.toLowerCase().split("-")[0]; // 'en-US' -> 'en'
        const normalizedSourceLang = transcription.language
          .toLowerCase()
          .split("-")[0];

        // Validate target language
        if (
          !asyncLabsSupportedLangs.some((lang) =>
            lang.toLowerCase().startsWith(normalizedTargetLang),
          )
        ) {
          throw new Error(
            `Target language '${targetLang}' not supported by Async Labs. Supported: ${asyncLabsSupportedLangs.join(", ")}`,
          );
        }

        // Check if source audio language is supported for voice cloning
        const sourceIsSupported = asyncLabsSupportedLangs.some((lang) =>
          lang.toLowerCase().startsWith(normalizedSourceLang),
        );

        if (!sourceIsSupported) {
          console.warn(
            `⚠️ Source language '${transcription.language}' not supported by Async Labs for voice cloning.`,
          );
          console.log(`   Using predefined voice instead of cloning.`);
        }

        // Step 4: Generate speech (with or without voice cloning based on source language)
        const speech = await this.generateSpeechAsyncLabs(
          translatedText,
          targetLang,
          sourceIsSupported ? convertedFilePath : null, // Only pass audio if source language is supported
        );

        return {
          filepath: speech.filepath,
          cleanup: () => {
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
      } else {
        // Piper workflow: Manual transcription → translation → synthesis
        // Step 2: Transcribe audio to text
        const transcription = await this.transcribeAudio(convertedFilePath);

        // Step 3: Translate text to target language
        const translatedText = await this.translateText(
          transcription.text,
          targetLang,
        );

        // Step 4: Generate speech in target language
        let speech;
        try {
          speech = await this.generateSpeechPiper(translatedText, targetLang);
        } catch (piperError) {
          console.warn(`⚠️ Piper synthesis failed: ${piperError.message}`);

          // Fallback to ElevenLabs when available so dubbing still works.
          if (
            this.elevenLabsApiKey &&
            this.elevenLabsApiKey !== "your_elevenlabs_api_key_here"
          ) {
            console.log("🔁 Falling back to ElevenLabs TTS...");
            speech = await this.generateSpeechElevenLabs(
              translatedText,
              targetLang,
              convertedFilePath,
            );
          } else if (
            this.asyncLabsApiKey &&
            this.asyncLabsApiKey !== "your_async_labs_api_key_here"
          ) {
            console.log("🔁 Falling back to Async Labs TTS...");
            speech = await this.generateSpeechAsyncLabs(
              translatedText,
              targetLang,
              convertedFilePath,
            );
          } else {
            throw piperError;
          }
        }

        return {
          filepath: speech.filepath,
          cleanup: () => {
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
      }
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
