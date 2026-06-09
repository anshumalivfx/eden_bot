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

  // EXIF metadata causes WhatsApp to reject stickers with download errors
  // Stickers work fine without it - WhatsApp handles them as regular stickers
  async addStickerMetadata(webpBuffer) {
    // Return buffer unchanged - no EXIF metadata needed
    return webpBuffer;
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

  isAnimatedWebp(webpBuffer) {
    if (!Buffer.isBuffer(webpBuffer)) return false;
    // Animated WebP files include ANIM/ANMF chunks.
    return (
      webpBuffer.includes(Buffer.from("ANIM")) ||
      webpBuffer.includes(Buffer.from("ANMF"))
    );
  }

  async convertStickerToDisplayMedia(stickerBuffer, filename = "upscaled") {
    if (this.isAnimatedWebp(stickerBuffer)) {
      try {
        const videoBuffer = await this.convertAnimatedWebpToMp4(
          stickerBuffer,
          filename,
        );
        return {
          type: "video",
          buffer: videoBuffer,
          mimetype: "video/mp4",
        };
      } catch (error) {
        console.warn("Animated sticker direct conversion failed, trying GIF path:", error.message);
        try {
          const videoBuffer = await this.convertAnimatedWebpToMp4ViaGif(
            stickerBuffer,
            filename,
          );
          return {
            type: "video",
            buffer: videoBuffer,
            mimetype: "video/mp4",
          };
        } catch (gifError) {
          console.warn(
            "Animated sticker GIF path failed, using first-frame fallback:",
            gifError.message,
          );
          const fallbackImage = await this.convertStickerToPng(stickerBuffer, true);
          return {
            type: "image",
            buffer: fallbackImage,
            mimetype: "image/png",
          };
        }
      }
    }

    const imageBuffer = await this.convertStickerToPng(stickerBuffer, false);
    return {
      type: "image",
      buffer: imageBuffer,
      mimetype: "image/png",
    };
  }

  async convertStickerToPng(stickerBuffer, firstFrameOnly = false) {
    if (firstFrameOnly) {
      return await sharp(stickerBuffer, {
        animated: true,
        page: 0,
        pages: 1,
      })
        .png()
        .toBuffer();
    }

    return await sharp(stickerBuffer).png().toBuffer();
  }

  async convertAnimatedWebpToMp4ViaGif(webpBuffer, filename = "upscaled") {
    return new Promise(async (resolve, reject) => {
      const inputGifPath = path.join(this.tempDir, `${filename}_input.gif`);
      const outputPath = path.join(this.tempDir, `${filename}_output.mp4`);

      try {
        const gifBuffer = await sharp(webpBuffer, { animated: true })
          .gif({ loop: 0 })
          .toBuffer();

        await fs.writeFile(inputGifPath, gifBuffer);

        ffmpeg(inputGifPath)
          .outputOptions([
            "-movflags",
            "faststart",
            "-pix_fmt",
            "yuv420p",
            "-vf",
            "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-an",
          ])
          .videoCodec("libx264")
          .format("mp4")
          .output(outputPath)
          .on("end", async () => {
            try {
              const videoBuffer = await fs.readFile(outputPath);
              await fs.unlink(inputGifPath).catch(() => {});
              await fs.unlink(outputPath).catch(() => {});
              resolve(videoBuffer);
            } catch (error) {
              reject(error);
            }
          })
          .on("error", async (error) => {
            await fs.unlink(inputGifPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});
            reject(new Error(`GIF to MP4 conversion failed: ${error.message}`));
          })
          .run();
      } catch (error) {
        await fs.unlink(inputGifPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        reject(new Error(`Failed to prepare GIF conversion: ${error.message}`));
      }
    });
  }

  async convertAnimatedWebpToMp4(webpBuffer, filename = "upscaled") {
    return new Promise((resolve, reject) => {
      const inputPath = path.join(this.tempDir, `${filename}_input.webp`);
      const outputPath = path.join(this.tempDir, `${filename}_output.mp4`);

      fs.writeFile(inputPath, webpBuffer)
        .then(() => {
          ffmpeg(inputPath)
            .outputOptions([
              "-movflags",
              "faststart",
              "-pix_fmt",
              "yuv420p",
              "-vf",
              "scale=trunc(iw/2)*2:trunc(ih/2)*2",
              "-an",
            ])
            .videoCodec("libx264")
            .format("mp4")
            .output(outputPath)
            .on("end", async () => {
              try {
                const videoBuffer = await fs.readFile(outputPath);
                await fs.unlink(inputPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});
                resolve(videoBuffer);
              } catch (error) {
                reject(error);
              }
            })
            .on("error", (error) => {
              fs.unlink(inputPath).catch(() => {});
              fs.unlink(outputPath).catch(() => {});
              reject(new Error(`Failed to convert animated sticker: ${error.message}`));
            })
            .run();
        })
        .catch((error) => {
          reject(new Error(`Failed to prepare sticker conversion: ${error.message}`));
        });
    });
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

  getStickerQuotes(isNiceUser = false) {
    if (isNiceUser) {
      return [
        "Here's your sticker! 🎨",
        "Made you a sticker!",
        "Your sticker is ready!",
        "Got your sticker done! 💫",
        "Here you go!",
        "All set! 😊",
        "Done! Hope you like it",
        "There you go! ✨",
      ];
    }

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

  getRandomStickerQuote(isNiceUser = false) {
    const quotes = this.getStickerQuotes(isNiceUser);
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  async createTextSticker(
    text,
    senderName = "User",
    filename = "text_sticker",
    options = {},
  ) {
    try {
      const outputPath = path.join(this.tempDir, `${filename}_text.webp`);

      // Clean and limit text length
      const cleanText = this.prepareStickerText(text).substring(0, 260);
      const lines = this.wrapText(cleanText, 27); // Wrap text to fit nicely
      const avatarDataUri = await this.createAvatarDataUri(options.avatarBuffer);
      const backgroundBuffer = await this.createTextStickerBackgroundBuffer();

      // Create SVG for the text sticker
      const svgText = this.createTextStickerSVG(lines, senderName, {
        avatarDataUri,
      });

      // Convert SVG to WebP using Sharp
      await sharp(backgroundBuffer)
        .composite([{ input: Buffer.from(svgText), blend: "over" }])
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

  async createMemeStickerFromSticker(
    stickerBuffer,
    memeText,
    filename = "meme_sticker",
  ) {
    try {
      const outputPath = path.join(this.tempDir, `${filename}_meme.webp`);

      const cleanText = (memeText || "").trim().substring(0, 120);
      if (!cleanText) {
        throw new Error("Meme text is empty");
      }

      const lines = this.wrapText(cleanText, 18).slice(0, 4);
      const textOverlay = this.createMemeTextOverlaySVG(lines);

      const stickerBase = await sharp(stickerBuffer, {
        animated: true,
        page: 0,
        pages: 1,
      })
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      await sharp(stickerBase)
        .composite([{ input: Buffer.from(textOverlay), blend: "over" }])
        .webp({ quality: 90 })
        .toFile(outputPath);

      let memeStickerBuffer = await fs.readFile(outputPath);
      memeStickerBuffer = await this.addStickerMetadata(memeStickerBuffer);

      await fs.unlink(outputPath).catch(() => {});

      return memeStickerBuffer;
    } catch (error) {
      console.error("Error creating meme sticker:", error);
      throw new Error("Failed to create meme sticker");
    }
  }

  createMemeTextOverlaySVG(lines) {
    const safeLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
    const lineCount = Math.max(1, Math.min(4, safeLines.length));
    const fontSize = lineCount >= 4 ? 42 : lineCount === 3 ? 48 : 54;
    const lineHeight = fontSize + 8;
    const baselineY = 508;
    const startY = baselineY - (lineCount - 1) * lineHeight;

    return `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="memeShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.35)"/>
    </linearGradient>
  </defs>

  <rect x="0" y="256" width="512" height="256" fill="url(#memeShade)"/>

  ${safeLines
    .map(
      (line, index) => `
  <text x="256" y="${startY + index * lineHeight}"
        text-anchor="middle"
        font-family="Impact, Arial Black, sans-serif"
        font-size="${fontSize}"
        font-weight="900"
        fill="#ffffff"
        stroke="#000000"
        stroke-width="6"
        paint-order="stroke fill"
        letter-spacing="1">${this.escapeXml(line.toUpperCase())}</text>`,
    )
    .join("")}
</svg>`;
  }

  wrapText(text, maxLength) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      if (word.length > maxLength) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = "";
        }

        for (let i = 0; i < word.length; i += maxLength) {
          lines.push(word.slice(i, i + maxLength));
        }
        continue;
      }

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

  prepareStickerText(text) {
    return String(text || "")
      .trim()
      .replace(/😔|😞|☹️|🙁/gu, ":(")
      .replace(/😂|🤣/gu, "xD")
      .replace(/😭/gu, "T_T")
      .replace(/❤️|♥️/gu, "<3")
      .replace(/🔥/gu, "fire")
      .replace(/✨/gu, "*")
      .replace(/\p{Extended_Pictographic}/gu, "")
      .replace(/[\uFE0E\uFE0F]/g, "")
      .replace(/\s+/g, " ");
  }

  getTextStickerThemes() {
    return [
      {
        name: "whatsapp",
      },
    ];
  }

  async createAvatarDataUri(avatarBuffer) {
    if (!Buffer.isBuffer(avatarBuffer)) {
      return null;
    }

    try {
      const pngBuffer = await sharp(avatarBuffer)
        .resize(96, 96, { fit: "cover" })
        .png()
        .toBuffer();

      return `data:image/png;base64,${pngBuffer.toString("base64")}`;
    } catch (error) {
      console.warn("Could not prepare avatar for text sticker:", error.message);
      return null;
    }
  }

  async createTextStickerBackgroundBuffer() {
    const backgroundPath = path.join(
      __dirname,
      "..",
      "background_chat",
      "patrick-drooling-patrick-star.gif",
    );

    try {
      return await sharp(backgroundPath, { animated: false })
        .resize(512, 512, { fit: "cover" })
        .blur(1)
        .modulate({ brightness: 0.42, saturation: 0.7 })
        .composite([
          {
            input: Buffer.from(
              '<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="#050708" opacity="0.56"/></svg>',
            ),
            blend: "over",
          },
        ])
        .png()
        .toBuffer();
    } catch (error) {
      console.warn(
        "Could not load text sticker chat background:",
        error.message,
      );

      return sharp(Buffer.from(this.createFallbackChatBackgroundSVG()))
        .png()
        .toBuffer();
    }
  }

  createFallbackChatBackgroundSVG() {
    return `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#060808"/>
  <g fill="none" stroke="#303536" stroke-width="4" opacity="0.35">
    <circle cx="52" cy="60" r="26"/>
    <circle cx="418" cy="86" r="34"/>
    <path d="M126 36 h92 v70 h-92 z"/>
    <path d="M32 286 h82 v64 h-82 z"/>
    <path d="M362 302 h96 v78 h-96 z"/>
    <path d="M152 390 c34 -48 96 -48 132 0"/>
    <path d="M278 156 l38 26 -22 40 -42 -24 z"/>
    <path d="M66 166 l70 46 -36 56 -72 -48 z"/>
    <path d="M404 178 c44 0 76 30 76 68"/>
  </g>
</svg>`;
  }

  createTextStickerSVG(lines, senderName, options = {}) {
    const safeLines = Array.isArray(lines) && lines.length ? lines : [""];
    const safeSender = this.formatDisplayName(senderName).slice(0, 26);
    const initials = this.getInitials(safeSender);
    const lineCount = safeLines.length;
    const fontSize = lineCount > 6 ? 22 : lineCount > 4 ? 24 : 27;
    const lineHeight = Math.round(fontSize * 1.35);
    const headerHeight = 38;
    const timeHeight = 28;
    const verticalPadding = 20;
    const contentHeight = headerHeight + safeLines.length * lineHeight + timeHeight;
    const bubbleHeight = Math.min(390, contentHeight + verticalPadding * 2);
    const bubbleY = Math.round((512 - bubbleHeight) / 2);
    const bubbleX = 88;
    const bubbleWidth = 420;
    const avatarSize = 58;
    const avatarX = 18;
    const avatarY = bubbleY + Math.max(20, Math.round((bubbleHeight - avatarSize) / 2));
    const messageTop = bubbleY + verticalPadding + headerHeight + fontSize;
    const timeLabel = this.getStickerTimeLabel();
    const timeY = bubbleY + bubbleHeight - 20;
    const avatarMarkup = options.avatarDataUri
      ? `<image href="${options.avatarDataUri}" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>`
      : `<circle cx="${avatarX + avatarSize / 2}" cy="${
          avatarY + avatarSize / 2
        }" r="${avatarSize / 2}" fill="url(#avatarGradient)"/>
         <text x="${avatarX + avatarSize / 2}" y="${
          avatarY + avatarSize / 2 + 8
        }" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#ffffff">${this.escapeXml(initials)}</text>`;

    return `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="bubbleShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
    <linearGradient id="avatarGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff6fae"/>
      <stop offset="100%" stop-color="#7f5af0"/>
    </linearGradient>
    <clipPath id="avatarClip">
      <circle cx="${avatarX + avatarSize / 2}" cy="${
        avatarY + avatarSize / 2
      }" r="${avatarSize / 2}"/>
    </clipPath>
  </defs>

  <circle cx="${avatarX + avatarSize / 2}" cy="${
      avatarY + avatarSize / 2
    }" r="${avatarSize / 2 + 3}" fill="#d9d0c8" opacity="0.95" filter="url(#bubbleShadow)"/>
  ${avatarMarkup}

  <path d="M${bubbleX + 22} ${bubbleY}
           H${bubbleX + bubbleWidth - 24}
           Q${bubbleX + bubbleWidth} ${bubbleY} ${
      bubbleX + bubbleWidth
    } ${bubbleY + 24}
           V${bubbleY + bubbleHeight - 24}
           Q${bubbleX + bubbleWidth} ${bubbleY + bubbleHeight} ${
      bubbleX + bubbleWidth - 24
    } ${bubbleY + bubbleHeight}
           H${bubbleX + 24}
           Q${bubbleX} ${bubbleY + bubbleHeight} ${bubbleX} ${
      bubbleY + bubbleHeight - 24
    }
           V${bubbleY + 52}
           L${bubbleX - 20} ${bubbleY + 42}
           L${bubbleX} ${bubbleY + 86}
           V${bubbleY + 24}
           Q${bubbleX} ${bubbleY} ${bubbleX + 22} ${bubbleY} Z"
        fill="#202526" filter="url(#bubbleShadow)"/>

  <text x="${bubbleX + 24}" y="${bubbleY + 35}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="24"
        font-weight="700"
        fill="#ff74ad">~ ${this.escapeXml(safeSender)}</text>

  ${safeLines
    .map(
      (line, index) => `
  <text x="${bubbleX + 24}" y="${messageTop + index * lineHeight}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="650"
        fill="#f1f4f3">${this.escapeXml(line)}</text>`,
    )
    .join("")}

  <text x="${bubbleX + bubbleWidth - 28}" y="${timeY}"
        text-anchor="end"
        font-family="Arial, Helvetica, sans-serif"
        font-size="22"
        font-weight="700"
        fill="#aeb5b7">${this.escapeXml(timeLabel)}</text>
</svg>`;
  }

  formatDisplayName(name) {
    const text = String(name || "").trim();
    if (!text || text.includes("@") || /^\+?\d{7,}$/.test(text)) {
      return "Unknown User";
    }

    return text;
  }

  getStickerTimeLabel() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
  }

  getInitials(name) {
    const words = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) {
      return "?";
    }

    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
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

  getTextStickerQuotes(isNiceUser = false) {
    if (isNiceUser) {
      return [
        "Made your text into a sticker! 💬",
        "Here's your quote sticker!",
        "Text sticker ready! 📱",
        "Got it done! 🎨",
        "Your message sticker! 💭",
        "Here you go! ✨",
        "All done! 🖼️",
        "Made this for you! 🎭",
      ];
    }

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

  getRandomTextStickerQuote(isNiceUser = false) {
    const quotes = this.getTextStickerQuotes(isNiceUser);
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  getMemeStickerQuotes(isNiceUser = false) {
    if (isNiceUser) {
      return [
        "Meme sticker ready! 📝",
        "Done! Added your text nicely.",
        "Your meme sticker is ready ✨",
        "Text added to sticker successfully!",
      ];
    }

    return [
      "Your meme sticker is ready. Comedy not guaranteed. 📝",
      "I added your text to the sticker. You're welcome, I guess.",
      "Meme deployed. The internet will recover eventually.",
      "Text on sticker: complete. Taste level: pending review.",
    ];
  }

  getRandomMemeStickerQuote(isNiceUser = false) {
    const quotes = this.getMemeStickerQuotes(isNiceUser);
    return quotes[Math.floor(Math.random() * quotes.length)];
  }
}

module.exports = StickerService;
