const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

class YouTubeService {
  constructor() {
    this.tempDir = path.join(__dirname, "../temp");
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Search for a video on YouTube and get the first result
   * @param {string} query - Search query
   * @returns {Promise<{title: string, url: string, videoId: string}>}
   */
  async searchYouTube(query) {
    try {
      // Using YouTube's search without API (scraping approach)
      // Note: This is a simplified version. For production, use YouTube Data API
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`;

      const response = await axios.get(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const html = response.data;

      // Extract video ID from the HTML
      const videoIdMatch = html.match(/"videoId":"([^"]+)"/);
      const titleMatch = html.match(/"title":{"runs":\[{"text":"([^"]+)"/);

      if (!videoIdMatch || !titleMatch) {
        throw new Error("Could not find video");
      }

      const videoId = videoIdMatch[1];
      const title = titleMatch[1].replace(/\\u[\dA-F]{4}/gi, (match) =>
        String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16))
      );

      return {
        title: title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoId: videoId,
      };
    } catch (error) {
      console.error("YouTube search error:", error);
      throw new Error("Failed to search YouTube");
    }
  }

  /**
   * Download YouTube video as MP3 using yt-dlp
   * @param {string} videoUrl - YouTube video URL
   * @param {string} outputName - Output filename (without extension)
   * @returns {Promise<{filepath: string, title: string, cleanup: Function}>}
   */
  async downloadAsMP3(videoUrl, outputName = "audio") {
    try {
      // Check if yt-dlp is installed - try common locations
      let ytdlpPath = "yt-dlp";
      try {
        await execAsync("yt-dlp --version");
      } catch (error) {
        // Try common installation paths
        const commonPaths = [
          "/opt/homebrew/bin/yt-dlp",
          "/usr/local/bin/yt-dlp",
          "/usr/bin/yt-dlp",
        ];
        let found = false;
        for (const p of commonPaths) {
          try {
            await execAsync(`${p} --version`);
            ytdlpPath = p;
            found = true;
            break;
          } catch {}
        }
        if (!found) {
          throw new Error(
            "yt-dlp not installed. Install with: brew install yt-dlp (Mac) or pip install yt-dlp"
          );
        }
      }

      // Check if ffmpeg is installed
      try {
        await execAsync("ffmpeg -version");
      } catch (error) {
        throw new Error(
          "ffmpeg not found. Install with: brew install ffmpeg (Mac) or sudo apt install ffmpeg (Linux)"
        );
      }

      const timestamp = Date.now();
      const safeOutputName = outputName
        .replace(/[^a-z0-9]/gi, "_")
        .substring(0, 50);
      const outputPath = path.join(
        this.tempDir,
        `${safeOutputName}_${timestamp}`
      );
      const finalPath = `${outputPath}.mp3`;

      console.log(`📥 Downloading: ${videoUrl}`);

      // Download using yt-dlp
      const command = `${ytdlpPath} -x --audio-format mp3 --audio-quality 0 -o "${outputPath}.%(ext)s" "${videoUrl}"`;

      await execAsync(command, {
        timeout: 120000, // 2 minute timeout
      });

      // Check if file exists
      if (!fs.existsSync(finalPath)) {
        throw new Error("Download failed - file not created");
      }

      const stats = fs.statSync(finalPath);
      console.log(`✅ Downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      return {
        filepath: finalPath,
        title: safeOutputName,
        cleanup: () => {
          if (fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
            console.log(`🗑️  Cleaned up: ${finalPath}`);
          }
        },
      };
    } catch (error) {
      console.error("Download error:", error);
      throw error;
    }
  }

  /**
   * Download thumbnail from YouTube
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<{filepath: string, cleanup: Function}>}
   */
  async downloadThumbnail(videoId) {
    try {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      const fallbackUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      const timestamp = Date.now();
      const thumbnailPath = path.join(
        this.tempDir,
        `thumb_${videoId}_${timestamp}.jpg`
      );

      console.log(`📸 Downloading thumbnail...`);

      // Try maxresdefault first, fallback to hqdefault
      let response;
      try {
        response = await axios.get(thumbnailUrl, {
          responseType: "arraybuffer",
        });
      } catch (error) {
        console.log(`⚠️  Max quality not available, using HQ...`);
        response = await axios.get(fallbackUrl, {
          responseType: "arraybuffer",
        });
      }

      fs.writeFileSync(thumbnailPath, response.data);
      console.log(`✅ Thumbnail saved`);

      return {
        filepath: thumbnailPath,
        cleanup: () => {
          if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
            console.log(`🗑️  Cleaned up thumbnail: ${thumbnailPath}`);
          }
        },
      };
    } catch (error) {
      console.error("Thumbnail download error:", error);
      return null; // Return null if thumbnail fails, don't stop the whole process
    }
  }

  /**
   * Download YouTube video as MP4 with progress callback
   * @param {string} videoUrl - YouTube video URL
   * @param {Function} progressCallback - Callback for progress updates (percent, status)
   * @returns {Promise<{filepath: string, title: string, thumbnail: string, cleanup: Function}>}
   */
  async downloadVideo(videoUrl, progressCallback = null) {
    try {
      // Check if yt-dlp is installed
      let ytdlpPath = "yt-dlp";
      try {
        await execAsync("yt-dlp --version");
      } catch (error) {
        const commonPaths = [
          "/opt/homebrew/bin/yt-dlp",
          "/usr/local/bin/yt-dlp",
          "/usr/bin/yt-dlp",
        ];
        let found = false;
        for (const p of commonPaths) {
          try {
            await execAsync(`${p} --version`);
            ytdlpPath = p;
            found = true;
            break;
          } catch {}
        }
        if (!found) {
          throw new Error(
            "yt-dlp not installed. Install with: brew install yt-dlp (Mac) or pip install yt-dlp"
          );
        }
      }

      // Check if ffmpeg is installed
      try {
        await execAsync("ffmpeg -version");
      } catch (error) {
        throw new Error(
          "ffmpeg not found. Install with: brew install ffmpeg (Mac) or sudo apt install ffmpeg (Linux)"
        );
      }

      if (progressCallback) progressCallback(0, "🔍 Fetching video info...");

      // Get video info first
      const infoCommand = `${ytdlpPath} -J "${videoUrl}"`;
      const { stdout: infoJson } = await execAsync(infoCommand, {
        timeout: 30000,
      });
      const videoInfo = JSON.parse(infoJson);
      const title = videoInfo.title || "video";
      const videoId = videoInfo.id || Date.now().toString();

      const timestamp = Date.now();
      const safeTitle = title.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
      const outputPath = path.join(this.tempDir, `${safeTitle}_${timestamp}`);
      const finalPath = `${outputPath}.mp4`;

      if (progressCallback) progressCallback(10, "⬇️ Starting download...");

      console.log(`📥 Downloading video: ${title}`);
      console.log(`🔗 URL: ${videoUrl}`);

      // Download with progress using spawn for real-time output
      const { spawn } = require("child_process");
      
      await new Promise((resolve, reject) => {
        const process = spawn(ytdlpPath, [
          "-f",
          "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best",
          "--merge-output-format",
          "mp4",
          "-o",
          `${outputPath}.%(ext)s`,
          videoUrl,
        ]);

        let lastProgress = 0;
        
        process.stdout.on("data", (data) => {
          const output = data.toString();
          console.log(output);
          
          // Parse download progress
          const progressMatch = output.match(/(\d+\.?\d*)%/);
          if (progressMatch && progressCallback) {
            const percent = parseFloat(progressMatch[1]);
            // Map download progress to 10-90%
            const mappedPercent = Math.min(90, 10 + (percent * 0.8));
            
            if (mappedPercent > lastProgress) {
              lastProgress = mappedPercent;
              const bar = this.createProgressBar(mappedPercent);
              progressCallback(mappedPercent, `⬇️ Downloading...\n${bar}`);
            }
          }
        });

        process.stderr.on("data", (data) => {
          const output = data.toString();
          console.log(output);
          
          // Also check stderr for progress
          const progressMatch = output.match(/(\d+\.?\d*)%/);
          if (progressMatch && progressCallback) {
            const percent = parseFloat(progressMatch[1]);
            const mappedPercent = Math.min(90, 10 + (percent * 0.8));
            
            if (mappedPercent > lastProgress) {
              lastProgress = mappedPercent;
              const bar = this.createProgressBar(mappedPercent);
              progressCallback(mappedPercent, `⬇️ Downloading...\n${bar}`);
            }
          }
        });

        process.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`yt-dlp exited with code ${code}`));
          }
        });

        process.on("error", (err) => {
          reject(err);
        });
      });

      if (progressCallback) progressCallback(95, "✅ Download complete!");

      // Check if file exists
      if (!fs.existsSync(finalPath)) {
        throw new Error("Download failed - video file not created");
      }

      const stats = fs.statSync(finalPath);
      const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`✅ Downloaded: ${fileSizeMB} MB`);

      // Download thumbnail with progress
      if (progressCallback) progressCallback(98, "📸 Getting thumbnail...");
      const thumbnail = await this.downloadThumbnail(videoId);

      if (progressCallback) progressCallback(100, "🎉 Ready to send!");

      return {
        filepath: finalPath,
        title: title,
        thumbnail: thumbnail,
        size: fileSizeMB,
        cleanup: () => {
          if (fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
            console.log(`🗑️  Cleaned up: ${finalPath}`);
          }
          if (thumbnail && thumbnail.filepath && fs.existsSync(thumbnail.filepath)) {
            thumbnail.cleanup();
          }
        },
      };
    } catch (error) {
      console.error("Video download error:", error);
      throw error;
    }
  }

  /**
   * Create a visual progress bar
   * @param {number} percent - Progress percentage (0-100)
   * @returns {string} Progress bar string
   */
  createProgressBar(percent) {
    const filled = Math.floor(percent / 5); // 20 blocks for 100%
    const empty = 20 - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    return `${bar} ${percent.toFixed(0)}%`;
  }

  /**
   * Search and download YouTube video as MP3
   * @param {string} query - Search query
   * @returns {Promise<{filepath: string, title: string, url: string, videoId: string, thumbnail: Object, cleanup: Function}>}
   */
  async searchAndDownload(query) {
    try {
      console.log(`🔍 Searching YouTube for: "${query}"`);

      // Search for the video
      const video = await this.searchYouTube(query);
      console.log(`🎵 Found: ${video.title}`);
      console.log(`🔗 URL: ${video.url}`);

      // Download the video as MP3
      const download = await this.downloadAsMP3(video.url, video.title);

      // Download thumbnail
      const thumbnail = await this.downloadThumbnail(video.videoId);

      return {
        ...download,
        url: video.url,
        title: video.title,
        videoId: video.videoId,
        thumbnail: thumbnail,
      };
    } catch (error) {
      console.error("Search and download error:", error);
      throw error;
    }
  }

  /**
   * Get sassy response for YouTube command
   */
  getRandomYouTubeQuote(isNiceUser = false) {
    if (isNiceUser) {
      const quotes = [
        "Here's your music! 🎵",
        "Downloaded! Enjoy! 🎧",
        "Your song is ready! 🎶",
        "Got it for you! 💫",
        "Here you go! 🎵",
        "All set! Enjoy the music! 🎶",
        "Downloaded! Hope you like it! 🎧",
      ];
      return quotes[Math.floor(Math.random() * quotes.length)];
    }

    const quotes = [
      "Here's your music. You're welcome. 🎵",
      "Downloaded. Try not to play it on repeat... oh who am I kidding. 🙄",
      "Your song is ready. My taste in music > yours btw. 💅",
      "Here. Now stop asking me to be your DJ. 🎧",
      "Downloaded your request. This better be good. 😒",
      "Song delivered. I'm basically Spotify now. Ugh. 🎶",
      "There. Happy now? Don't make this a habit. 💿",
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  /**
   * Clean up old files in temp directory
   */
  cleanupOldFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes

      files.forEach((file) => {
        const filepath = path.join(this.tempDir, file);
        const stats = fs.statSync(filepath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          fs.unlinkSync(filepath);
          console.log(`🗑️  Cleaned up old file: ${file}`);
        }
      });
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }
}

module.exports = YouTubeService;
