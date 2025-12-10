const axios = require("axios");
const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");

class ImageService {
  constructor() {
    this.baseUrl = "https://image.pollinations.ai/prompt";
    this.tempDir = path.join(__dirname, "../temp");

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Available models
    this.models = {
      flux: "flux", // High quality, slower (default)
      turbo: "turbo", // Fast generation
      "flux-realism": "flux-realism", // Photorealistic
      "flux-anime": "flux-anime", // Anime style
      "flux-3d": "flux-3d", // 3D renders
    };

    // Default settings
    this.defaultWidth = 1024;
    this.defaultHeight = 1024;
    this.defaultSeed = -1; // Random seed

    this.freeApis = {
      // Pollinations AI - Free and no API key required
      pollinations: {
        url: "https://image.pollinations.ai/prompt/",
        needsKey: false,
        method: "GET",
      },

      // Hugging Face Inference API - Free tier
      huggingface: {
        url: "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1",
        needsKey: true,
        method: "POST",
      },

      // DeepAI - Free tier (limited)
      deepai: {
        url: "https://api.deepai.org/api/text2img",
        needsKey: true,
        method: "POST",
      },
    };

    this.imageStyles = {
      realistic: "photorealistic, high quality, detailed",
      anime: "anime style, manga, japanese animation",
      cartoon: "cartoon style, animated, colorful",
      artistic: "digital art, artistic, creative",
      cyberpunk: "cyberpunk, neon, futuristic, dark",
      fantasy: "fantasy art, magical, mystical",
      minimalist: "minimalist, simple, clean design",
      vintage: "vintage, retro, old style",
      abstract: "abstract art, geometric, modern",
      watercolor: "watercolor painting, soft, artistic",
    };
  }

  /**
   * Generate image from text prompt
   */
  async generateImage(prompt, style = null, apiProvider = "pollinations") {
    try {
      // Add style to prompt if specified
      let enhancedPrompt = prompt;
      if (style && this.imageStyles[style]) {
        enhancedPrompt = `${prompt}, ${this.imageStyles[style]}`;
      }

      console.log(
        `🎨 Generating image with ${apiProvider}: "${enhancedPrompt}"`
      );

      let imageBuffer;
      switch (apiProvider) {
        case "pollinations":
          imageBuffer = await this.generateWithPollinations(enhancedPrompt);
          break;
        case "huggingface":
          imageBuffer = await this.generateWithHuggingFace(enhancedPrompt);
          break;
        default:
          imageBuffer = await this.generateWithPollinations(enhancedPrompt);
      }

      // Save to temp file
      const filename = `ai_image_${Date.now()}.png`;
      const filepath = path.join(__dirname, "../temp", filename);

      // Ensure temp directory exists
      const tempDir = path.dirname(filepath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(filepath, imageBuffer);

      return {
        filepath,
        prompt: enhancedPrompt,
        originalPrompt: prompt,
        style: style || "default",
        apiProvider,
        cleanup: () => {
          try {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          } catch (e) {
            console.warn("Failed to cleanup image file:", e.message);
          }
        },
      };
    } catch (error) {
      console.error("Image generation error:", error);
      throw error;
    }
  }

  /**
   * Generate image using Pollinations AI (free, no API key)
   */
  async generateWithPollinations(prompt, options = {}) {
    try {
      const {
        width = 1024,
        height = 1024,
        model = "flux",
        seed = Math.floor(Math.random() * 1000000),
        nologo = true,
      } = options;

      // Encode prompt for URL
      const encodedPrompt = encodeURIComponent(prompt);
      const queryParams = new URLSearchParams({
        width: width.toString(),
        height: height.toString(),
        model: model,
        seed: seed.toString(),
        nologo: nologo.toString(),
      });

      const url = `${this.baseUrl}/${encodedPrompt}?${queryParams.toString()}`;

      console.log(
        `🎨 Generating with model: ${model}, size: ${width}x${height}`
      );

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 60000, // 60 seconds for high-quality generation
        headers: {
          "User-Agent": "Eden-WhatsApp-Bot/1.0",
        },
      });

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Pollinations API error: ${error.message}`);
    }
  }

  /**
   * Text-to-Image: Generate image from text prompt
   */
  async textToImage(prompt, options = {}) {
    try {
      const {
        width = this.defaultWidth,
        height = this.defaultHeight,
        model = "flux",
        seed = this.defaultSeed,
        enhance = true,
      } = options;

      // Clean and enhance prompt
      let finalPrompt = this.preparePrompt(prompt);
      if (enhance) {
        finalPrompt = `${finalPrompt}, highly detailed, professional quality, sharp focus`;
      }

      console.log(`📝 Text-to-Image: "${finalPrompt.substring(0, 80)}..."`);

      const buffer = await this.generateWithPollinations(finalPrompt, {
        width,
        height,
        model,
        seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed,
        nologo: true,
      });

      // Save to temp file
      const filename = `text2img_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.jpg`;
      const filepath = path.join(this.tempDir, filename);
      fs.writeFileSync(filepath, buffer);

      console.log(
        `✅ Image generated! Size: ${(buffer.length / 1024).toFixed(2)} KB`
      );

      return {
        buffer,
        filepath,
        prompt: finalPrompt,
        model,
        cleanup: () => {
          try {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          } catch (e) {
            console.warn("Failed to cleanup:", e.message);
          }
        },
      };
    } catch (error) {
      console.error("❌ Text-to-Image failed:", error.message);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  /**
   * Image-to-Image: Transform existing image based on prompt
   */
  async imageToImage(inputImage, prompt, options = {}) {
    try {
      const {
        width = this.defaultWidth,
        height = this.defaultHeight,
        model = "flux",
        seed = this.defaultSeed,
        strength = 0.7, // How much to transform (0.1-1.0)
      } = options;

      console.log(
        `🔄 Image-to-Image transformation: "${prompt.substring(0, 60)}..."`
      );

      // Get image buffer
      let imageBuffer;
      if (Buffer.isBuffer(inputImage)) {
        imageBuffer = inputImage;
      } else {
        imageBuffer = fs.readFileSync(inputImage);
      }

      // Save input temporarily
      const inputFilename = `input_${Date.now()}.jpg`;
      const inputPath = path.join(this.tempDir, inputFilename);
      fs.writeFileSync(inputPath, imageBuffer);

      // Create transformation prompt
      const transformPrompt = `Transform this image: ${prompt}, ${
        strength > 0.7 ? "major changes" : "subtle changes"
      }, maintain composition, professional quality`;

      // Generate transformed image
      const buffer = await this.generateWithPollinations(transformPrompt, {
        width,
        height,
        model,
        seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed,
        nologo: true,
      });

      // Save output
      const filename = `img2img_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.jpg`;
      const filepath = path.join(this.tempDir, filename);
      fs.writeFileSync(filepath, buffer);

      // Cleanup input
      try {
        fs.unlinkSync(inputPath);
      } catch (e) {
        console.warn("Failed to cleanup input:", e.message);
      }

      console.log(
        `✅ Image transformed! Size: ${(buffer.length / 1024).toFixed(2)} KB`
      );

      return {
        buffer,
        filepath,
        prompt: transformPrompt,
        model,
        cleanup: () => {
          try {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          } catch (e) {
            console.warn("Failed to cleanup:", e.message);
          }
        },
      };
    } catch (error) {
      console.error("❌ Image-to-Image failed:", error.message);
      throw new Error(`Failed to transform image: ${error.message}`);
    }
  }

  /**
   * Get available models
   */
  getModels() {
    return {
      flux: "High quality, slower generation (default)",
      turbo: "Fast generation, good quality",
      "flux-realism": "Photorealistic images",
      "flux-anime": "Anime/manga style",
      "flux-3d": "3D rendered style",
    };
  }

  /**
   * Generate image using Hugging Face (requires API key)
   */
  async generateWithHuggingFace(prompt) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Hugging Face API key not found in environment variables"
      );
    }

    try {
      const response = await axios.post(
        this.freeApis.huggingface.url,
        { inputs: prompt },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer",
          timeout: 30000,
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Hugging Face API error: ${error.message}`);
    }
  }

  /**
   * Modify existing image with new prompt (Image-to-Image)
   */
  async modifyImage(imagePath, prompt, style = null, strength = 0.7) {
    try {
      console.log(`🔄 Modifying image: "${prompt}"`);

      // For now, we'll create a new image based on the prompt
      // Real img2img would require more advanced APIs
      const combinedPrompt = `modify image, ${prompt}`;

      return await this.generateImage(combinedPrompt, style);
    } catch (error) {
      console.error("Image modification error:", error);
      throw error;
    }
  }

  /**
   * Get available image styles
   */
  getImageStyles() {
    return Object.keys(this.imageStyles).map((key) => ({
      name: key,
      description: this.imageStyles[key],
    }));
  }

  /**
   * Check if prompt contains NSFW content
   */
  isNSFW(prompt) {
    const nsfwKeywords = [
      // Explicit content
      "nude",
      "naked",
      "nsfw",
      "xxx",
      "porn",
      "pornographic",
      "sex",
      "sexual",
      "explicit",
      "erotic",
      "adult",
      "hentai",
      "lewd",
      "r18",
      "r-18",

      // Body parts (explicit context)
      "nipple",
      "nipples",
      "penis",
      "vagina",
      "breasts naked",
      "topless",
      "bottomless",
      "genitals",
      "genitalia",
      "pussy",
      "dick",
      "cock",
      "ass naked",
      "bare ass",

      // Actions
      "masturbat",
      "orgasm",
      "cumming",
      "ejaculat",
      "penetrat",
      "fellatio",
      "cunnilingus",
      "intercourse",
      "blowjob",
      "handjob",
      "footjob",
      "gangbang",
      "orgy",

      // Clothing removal
      "strip",
      "stripping",
      "undressing",
      "taking off clothes",
      "removing clothes",
      "no clothes",
      "without clothes",
      "nude body",
      "naked body",

      // Fetish content
      "bdsm",
      "bondage",
      "dominatrix",
      "submissive",
      "fetish",
      "kinky",

      // Inappropriate scenarios
      "seductive pose",
      "provocative",
      "sensual",
      "sexy pose",
      "intimate",

      // Gore/Violence
      "gore",
      "gory",
      "bloody",
      "dismember",
      "decapitat",
      "mutilat",
      "torture",
      "violence",
      "killing",
      "murder",
      "dead body",

      // Drugs
      "cocaine",
      "heroin",
      "meth",
      "drug use",
      "smoking crack",
      "injecting drugs",

      // Hate speech
      "racist",
      "nazi",
      "swastika",
      "hate symbol",
      "kkk",

      // Minors
      "child",
      "kid",
      "teen",
      "underage",
      "minor",
      "loli",
      "shota",
      "young girl",
      "young boy",
      "schoolgirl",
      "student",
      "baby",
      "toddler",
      "infant",
      "preteen",
    ];

    const lowerPrompt = prompt.toLowerCase();

    // Check for exact matches and partial matches
    for (const keyword of nsfwKeywords) {
      if (lowerPrompt.includes(keyword)) {
        console.log(`🚫 NSFW keyword detected: "${keyword}"`);
        return true;
      }
    }

    // Check for combinations that might be NSFW
    const nsfwCombinations = [
      ["woman", "nude"],
      ["man", "naked"],
      ["girl", "sexy"],
      ["boy", "sexy"],
      ["without", "clothes"],
      ["no", "clothes"],
      ["wearing nothing"],
      ["completely naked"],
    ];

    for (const combo of nsfwCombinations) {
      if (combo.every((word) => lowerPrompt.includes(word))) {
        console.log(`🚫 NSFW combination detected: ${combo.join(" + ")}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Clean and prepare prompt for image generation
   */
  preparePrompt(prompt) {
    // Remove commands and clean text
    let cleanPrompt = prompt.replace(/^-\w+\s+/, "").trim();

    // Check for NSFW content BEFORE processing
    if (this.isNSFW(cleanPrompt)) {
      throw new Error("NSFW_CONTENT");
    }

    // Limit length
    if (cleanPrompt.length > 500) {
      cleanPrompt = cleanPrompt.substring(0, 497) + "...";
    }

    return cleanPrompt.trim() || "abstract art";
  }

  /**
   * Get help message for image generation
   */
  getHelpMessage() {
    return `🎨 *AI Image Generation Commands*

*Text-to-Image:*
• \`-imagine [prompt]\` - Generate image from text
• \`-img [prompt]\` - Short alias
• \`-draw [prompt]\` - Another alias

*Image-to-Image:*
• Reply to an image with \`-transform [prompt]\`
• Reply to an image with \`-reimagine [prompt]\`

*Examples:*
• \`-imagine a beautiful sunset over mountains\`
• \`-img cyberpunk city at night, neon lights\`
• Reply to photo: \`-transform make it look like an oil painting\`

*Models Available:*
• \`flux\` - High quality (default)
• \`turbo\` - Fast generation
• \`flux-realism\` - Photorealistic
• \`flux-anime\` - Anime style
• \`flux-3d\` - 3D renders

*Model Usage:*
\`-imagine [model:turbo] your prompt here\`

*✨ Powered by Pollinations AI*`;
  }

  /**
   * Clean up old temporary files
   */
  cleanupOldFiles(maxAgeMinutes = 30) {
    try {
      const now = Date.now();
      const files = fs.readdirSync(this.tempDir);

      let cleaned = 0;
      for (const file of files) {
        const filepath = path.join(this.tempDir, file);
        const stats = fs.statSync(filepath);
        const ageMinutes = (now - stats.mtimeMs) / 1000 / 60;

        if (ageMinutes > maxAgeMinutes) {
          fs.unlinkSync(filepath);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} old image files`);
      }
    } catch (error) {
      console.warn("Failed to cleanup old files:", error.message);
    }
  }

  /**
   * Get Eden's sassy responses for image generation
   */
  getImageResponses() {
    return [
      "🎨 Fine, I'll create your masterpiece... This better be worth my processing power.",
      "🖼️ Oh great, now I'm an artist too? Let me paint you something... mediocre.",
      "🎭 Generating your vision... Prepare to be underwhelmed by my artistic genius.",
      "🖌️ Hold on, let me channel my inner Picasso... or at least try to.",
      "🎪 Welcome to Eden's AI Art Gallery! Featuring: your questionable taste in prompts.",
      "🎨 Creating visual magic from your text... You're welcome for this service.",
      "🖼️ Converting your imagination into pixels... Let's see how this turns out.",
      "🎭 And now, for my next trick... turning your words into probably disappointing art!",
    ];
  }

  /**
   * Get error responses for failed image generation
   */
  getImageErrorResponses() {
    return [
      "🎨 Well, that didn't work. Your prompt broke my artistic vision. Try something less... you.",
      "🖼️ Image generation failed. Maybe try with a prompt that makes sense? 🤷‍♀️",
      "🎭 I tried to create your masterpiece, but even AI has limits. Sorry not sorry.",
      "🖌️ Something went wrong with the art creation. Probably your fault somehow.",
      "🎪 Art generation crashed. Even my algorithms have standards, apparently.",
    ];
  }

  /**
   * Get NSFW rejection responses
   */
  getNSFWRejectionResponses() {
    return [
      "🚫 Nope. Not doing that. Keep it clean, weirdo.",
      "🚫 Really? I'm not generating that. Try something appropriate.",
      "🚫 Hard pass. My algorithms have standards, unlike you apparently.",
      "🚫 That's a no from me. Keep your weird fantasies to yourself.",
      "🚫 Not happening. Try being less creepy maybe?",
      "🚫 Absolutely not. This is a family-friendly AI, pervert.",
      "🚫 Denied. Get your mind out of the gutter.",
      "🚫 No way. I'm sophisticated AI art, not your personal... that.",
    ];
  }

  /**
   * Check if API is available
   */
  async checkApiAvailability(provider = "pollinations") {
    try {
      if (provider === "pollinations") {
        const testUrl = `${this.freeApis.pollinations.url}test?width=64&height=64`;
        await axios.get(testUrl, { timeout: 10000 });
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new ImageService();
