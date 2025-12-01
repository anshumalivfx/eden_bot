const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const fs = require("fs").promises;
const path = require("path");
const { Image } = require("node-webpmux");

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class StickerService {
  constructor() {
    this.tempDir = path.join(__dirname, "..", "temp");
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  async addStickerMetadata(webpBuffer) {
    try {
      const img = new Image();
      await img.load(webpBuffer);

      const stickerPackId = "com.anshbot.stickers";
      const stickerPackName = "Ansh Bot Stickers";
      const stickerPackPublisher = "Ansh Bot";

      // Create proper EXIF JSON format for WhatsApp stickers (Android & iOS compatible)
      const exifData = {
        "sticker-pack-id": stickerPackId,
        "sticker-pack-name": stickerPackName,
        "sticker-pack-publisher": stickerPackPublisher,
        "android-app-store-link": "https://play.google.com/store/apps/details?id=com.anshbot.stickers",
        "ios-app-store-link": "https://apps.apple.com/app/anshbot-stickers/id123456789",
        "emojis": ["😀", "😂", "❤️"],
        "is-first-party-sticker": 0
      };

      const exifStr = JSON.stringify(exifData);
      img.exif = Buffer.from(exifStr, 'utf-8');

      return await img.save(null);
    } catch (error) {
      console.error("Error adding sticker metadata:", error);
      return webpBuffer; // Return original if metadata fails
    }
  }

  async createStickerFromImage(imageBuffer, filename = "sticker") {
    try {
      const outputPath = path.join(this.tempDir, `${filename}_sticker.webp`);

      // Process image with sharp - resize to sticker dimensions and convert to WebP
      await sharp(imageBuffer)
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        })
        .webp({ quality: 90 })
        .toFile(outputPath);

      // Read the processed file
      let stickerBuffer = await fs.readFile(outputPath);

      // Add EXIF metadata for WhatsApp sticker pack
      stickerBuffer = await this.addStickerMetadata(stickerBuffer);

      // Clean up temp file
      await fs.unlink(outputPath).catch(() => {});

      return stickerBuffer;
    } catch (error) {
      console.error("Error creating sticker from image:", error);
      throw new Error("Failed to create sticker from image");
    }
  }

  async createStickerFromGif(gifBuffer, filename = "sticker") {
    return new Promise((resolve, reject) => {
      const inputPath = path.join(this.tempDir, `${filename}_input.gif`);
      const outputPath = path.join(this.tempDir, `${filename}_sticker.webp`);

      // Write gif to temp file
      fs.writeFile(inputPath, gifBuffer)
        .then(() => {
          // Convert GIF to animated WebP using ffmpeg
          ffmpeg(inputPath)
            .outputOptions([
              "-vf",
              "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=00000000",
              "-f",
              "webp",
              "-loop",
              "0", // Infinite loop
              "-preset",
              "default",
              "-an", // No audio
            ])
            .output(outputPath)
            .on("end", async () => {
              try {
                let stickerBuffer = await fs.readFile(outputPath);

                // Add EXIF metadata for WhatsApp sticker pack
                stickerBuffer = await this.addStickerMetadata(stickerBuffer);

                // Clean up temp files
                await fs.unlink(inputPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});

                resolve(stickerBuffer);
              } catch (error) {
                reject(error);
              }
            })
            .on("error", (error) => {
              console.error("FFmpeg error:", error);
              // Clean up temp files
              fs.unlink(inputPath).catch(() => {});
              fs.unlink(outputPath).catch(() => {});
              reject(new Error("Failed to convert GIF to sticker"));
            })
            .run();
        })
        .catch(reject);
    });
  }

  async downloadMedia(message) {
    try {
      const media = await message.downloadMedia();
      if (!media) {
        throw new Error("No media found in message");
      }

      // Check if media is already in buffer format (Baileys)
      if (media.buffer) {
        return {
          buffer: media.buffer,
          mimetype: media.mimetype,
          filename: media.filename || "media",
        };
      }

      // Otherwise convert base64 to buffer (old format)
      const buffer = Buffer.from(media.data, "base64");

      return {
        buffer,
        mimetype: media.mimetype,
        filename: media.filename || "media",
      };
    } catch (error) {
      console.error("Error downloading media:", error);
      throw new Error("Failed to download media from message");
    }
  }

  isImage(mimetype) {
    return (
      mimetype && mimetype.startsWith("image/") && !mimetype.includes("gif")
    );
  }

  isGif(mimetype) {
    return mimetype && (mimetype === "image/gif" || mimetype.includes("gif"));
  }

  isVideo(mimetype) {
    return mimetype && mimetype.startsWith("video/");
  }

  async createStickerFromVideo(videoBuffer, filename = "sticker") {
    return new Promise((resolve, reject) => {
      const inputPath = path.join(this.tempDir, `${filename}_input.mp4`);
      const outputPath = path.join(this.tempDir, `${filename}_sticker.webp`);

      // Write video to temp file
      fs.writeFile(inputPath, videoBuffer)
        .then(() => {
          // Convert video to animated WebP (max 3 seconds)
          ffmpeg(inputPath)
            .outputOptions([
              "-t",
              "3", // Limit to 3 seconds
              "-vf",
              "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=00000000",
              "-f",
              "webp",
              "-loop",
              "0",
              "-preset",
              "default",
              "-an", // No audio
            ])
            .output(outputPath)
            .on("end", async () => {
              try {
                let stickerBuffer = await fs.readFile(outputPath);

                // Add EXIF metadata
                stickerBuffer = await this.addStickerMetadata(stickerBuffer);

                // Clean up temp files
                await fs.unlink(inputPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});

                resolve(stickerBuffer);
              } catch (error) {
                reject(error);
              }
            })
            .on("error", (error) => {
              console.error("FFmpeg video error:", error);
              // Clean up temp files
              fs.unlink(inputPath).catch(() => {});
              fs.unlink(outputPath).catch(() => {});
              reject(new Error("Failed to convert video to sticker"));
            })
            .run();
        })
        .catch(reject);
    });
  }

  getStickerQuotes() {
    return [
      "Oh great, another masterpiece. 🎨",
      "I've turned your image into something slightly less disappointing.",
      "Here's your sticker. Try not to spam it too much.",
      "Congratulations, you've discovered the sticker feature. Revolutionary!",
      "I've processed your image with the enthusiasm of a sloth.",
      "Your sticker is ready. It's about as exciting as you'd expect.",
      "Here's your precious sticker. Handle with care... or don't.",
      "I've transformed your image into sticker format. You're welcome, I guess.",
    ];
  }

  getRandomStickerQuote() {
    const quotes = this.getStickerQuotes();
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  async createTextSticker(
    text,
    senderName = "User",
    filename = "text_sticker"
  ) {
    try {
      const outputPath = path.join(this.tempDir, `${filename}_text.webp`);

      // Clean and limit text length
      const cleanText = text.trim().substring(0, 200); // Limit to 200 characters
      const lines = this.wrapText(cleanText, 25); // Wrap text to fit nicely

      // Choose random theme
      const themes = this.getTextStickerThemes();
      const theme = themes[Math.floor(Math.random() * themes.length)];

      // Create SVG for the text sticker
      const svgText = this.createTextStickerSVG(lines, senderName, theme);

      // Convert SVG to WebP using Sharp
      await sharp(Buffer.from(svgText))
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 90 })
        .toFile(outputPath);

      // Read the processed file
      let stickerBuffer = await fs.readFile(outputPath);

      // Add EXIF metadata
      stickerBuffer = await this.addStickerMetadata(stickerBuffer);

      // Clean up temp file
      await fs.unlink(outputPath).catch(() => {});

      return stickerBuffer;
    } catch (error) {
      console.error("Error creating text sticker:", error);
      throw new Error("Failed to create text sticker");
    }
  }

  wrapText(text, maxLength) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + word).length <= maxLength) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines.slice(0, 8); // Limit to 8 lines
  }

  getTextStickerThemes() {
    return [
      {
        name: "classic",
        bg: "#FFFFFF",
        border: "#000000",
        textColor: "#000000",
        headerColor: "#666666",
        shadow: "rgba(0,0,0,0.2)",
      },
      {
        name: "dark",
        bg: "#2C2C2C",
        border: "#555555",
        textColor: "#FFFFFF",
        headerColor: "#CCCCCC",
        shadow: "rgba(255,255,255,0.1)",
      },
      {
        name: "blue",
        bg: "#E3F2FD",
        border: "#1976D2",
        textColor: "#0D47A1",
        headerColor: "#1976D2",
        shadow: "rgba(25,118,210,0.2)",
      },
      {
        name: "green",
        bg: "#E8F5E8",
        border: "#4CAF50",
        textColor: "#2E7D32",
        headerColor: "#4CAF50",
        shadow: "rgba(76,175,80,0.2)",
      },
      {
        name: "purple",
        bg: "#F3E5F5",
        border: "#9C27B0",
        textColor: "#6A1B9A",
        headerColor: "#9C27B0",
        shadow: "rgba(156,39,176,0.2)",
      },
      {
        name: "orange",
        bg: "#FFF3E0",
        border: "#FF9800",
        textColor: "#E65100",
        headerColor: "#FF9800",
        shadow: "rgba(255,152,0,0.2)",
      },
    ];
  }

  createTextStickerSVG(lines, senderName, theme) {
    const lineHeight = 30;
    const padding = 40;
    const headerHeight = 50;
    const contentHeight = lines.length * lineHeight;
    const totalHeight = headerHeight + contentHeight + padding * 2;

    const maxWidth = Math.max(
      ...lines.map((line) => line.length * 12), // Approximate character width
      senderName.length * 12 + 100 // Header width
    );
    const width = Math.max(400, Math.min(500, maxWidth + padding * 2));

    return `
        <svg width="${width}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="${
                      theme.shadow
                    }"/>
                </filter>
            </defs>
            
            <!-- Background -->
            <rect width="${width}" height="${totalHeight}" rx="20" ry="20" 
                  fill="${theme.bg}" stroke="${
      theme.border
    }" stroke-width="3" filter="url(#shadow)"/>
            
            <!-- Header -->
            <rect x="0" y="0" width="${width}" height="${headerHeight}" rx="20" ry="20" 
                  fill="${theme.border}" opacity="0.1"/>
            <line x1="20" y1="${headerHeight}" x2="${
      width - 20
    }" y2="${headerHeight}" 
                  stroke="${theme.border}" stroke-width="1" opacity="0.3"/>
            
            <!-- Header Text -->
            <text x="${padding}" y="${headerHeight / 2 + 6}" 
                  font-family="Arial, sans-serif" font-size="16" font-weight="bold" 
                  fill="${theme.headerColor}">💬 ${this.escapeXml(
      senderName
    )}</text>
            
            <!-- Message Icon -->
            <text x="${width - 60}" y="${headerHeight / 2 + 6}" 
                  font-family="Arial, sans-serif" font-size="20">📱</text>
            
            <!-- Message Lines -->
            ${lines
              .map(
                (line, index) => `
                <text x="${padding}" y="${
                  headerHeight + padding + index * lineHeight
                }" 
                      font-family="Arial, sans-serif" font-size="18" 
                      fill="${theme.textColor}">${this.escapeXml(line)}</text>
            `
              )
              .join("")}
            
            <!-- Quote marks -->
            <text x="${padding - 15}" y="${headerHeight + padding + 5}" 
                  font-family="serif" font-size="40" font-weight="bold" 
                  fill="${theme.border}" opacity="0.3">"</text>
            <text x="${width - padding}" y="${
      headerHeight + contentHeight + padding - 10
    }" 
                  font-family="serif" font-size="40" font-weight="bold" 
                  fill="${theme.border}" opacity="0.3">"</text>
        </svg>`;
  }

  escapeXml(text) {
    return text.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "&":
          return "&amp;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return c;
      }
    });
  }

  getTextStickerQuotes() {
    return [
      "I've turned your words into a sticker. Groundbreaking. 💬",
      "Here's your text in sticker form. Revolutionary technology at work. 🙄",
      "Congratulations, you've made a message box sticker. The future is now! 📱",
      "I've immortalized your text in sticker format. You're welcome. 🎨",
      "Your words are now a sticker. Try not to let it go to your head. 💭",
      "I've created a text sticker from your message. Aren't you special? ✨",
      "Here's your quote in sticker form. Frame it if you want. 🖼️",
      "I've turned your text into art. Well, 'art' is a strong word... 🎭",
    ];
  }

  getRandomTextStickerQuote() {
    const quotes = this.getTextStickerQuotes();
    return quotes[Math.floor(Math.random() * quotes.length)];
  }
}

module.exports = StickerService;
