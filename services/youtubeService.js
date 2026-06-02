const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");
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

  async resolveYtDlpPath() {
    const candidates = [
      "/opt/anaconda3/bin/yt-dlp",
      "/opt/homebrew/bin/yt-dlp",
      "/usr/local/bin/yt-dlp",
      "/usr/bin/yt-dlp",
      path.join(process.cwd(), "venv/bin/yt-dlp"),
      path.join(process.cwd(), ".venv/bin/yt-dlp"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          await execAsync(`"${candidate}" --version`);
          return candidate;
        } catch {}
      }
    }

    try {
      const { stdout } = await execAsync("command -v yt-dlp");
      const resolvedPath = stdout.trim().split("\n")[0];
      if (resolvedPath) {
        return resolvedPath;
      }
    } catch {}

    return "yt-dlp";
  }

  normalizeYouTubeUrl(videoUrl, preferredHost = "youtube.com") {
    if (!videoUrl) return videoUrl;

    const urlText = String(videoUrl).trim();

    try {
      const parsedUrl = new URL(
        urlText.startsWith("http") ? urlText : `https://${urlText}`,
      );
      const host =
        preferredHost === "m.youtube.com" ? "m.youtube.com" : "youtube.com";

      if (
        parsedUrl.hostname.includes("youtu.be") ||
        parsedUrl.pathname.includes("/shorts/")
      ) {
        return parsedUrl.toString();
      }

      if (
        parsedUrl.hostname === "www.youtube.com" ||
        parsedUrl.hostname === "youtube.com" ||
        parsedUrl.hostname === "m.youtube.com"
      ) {
        parsedUrl.hostname = host;
        parsedUrl.protocol = "https:";
        return parsedUrl.toString();
      }
    } catch (error) {
      // Fall back to the original URL if parsing fails.
    }

    return urlText;
  }

  buildYouTubeFallbackUrls(videoUrl) {
    const urls = [];
    const canonicalUrl = this.normalizeYouTubeUrl(videoUrl, "youtube.com");
    const mobileUrl = this.normalizeYouTubeUrl(videoUrl, "m.youtube.com");

    for (const candidateUrl of [canonicalUrl, mobileUrl, videoUrl]) {
      if (candidateUrl && !urls.includes(candidateUrl)) {
        urls.push(candidateUrl);
      }
    }

    return urls;
  }

  getYouTubeNetworkErrorMessage(videoUrl, error) {
    const errorMessage = error?.message || "";
    const stderr = error?.stderr || "";
    const combinedText = `${errorMessage}\n${stderr}`;

    if (
      combinedText.includes("Failed to resolve") ||
      combinedText.includes("nodename nor servname provided")
    ) {
      return [
        "YouTube could not be resolved from this server.",
        "Check DNS/network access for youtube.com and www.youtube.com.",
        "If the server is behind a proxy or restricted network, configure outbound internet access.",
        `Video URL tried: ${videoUrl}`,
      ].join(" ");
    }

    return null;
  }

  getCookiesArg() {
    // 1. Check for explicit path in environment variable
    const envCookiePath = process.env.YTDLP_COOKIES_PATH;
    if (envCookiePath && fs.existsSync(envCookiePath)) {
      return ["--cookies", envCookiePath];
    }

    // 2. Check for default cookies.txt in root directory
    const defaultCookiePath = path.join(process.cwd(), "cookies.txt");
    if (fs.existsSync(defaultCookiePath)) {
      return ["--cookies", defaultCookiePath];
    }

    // 3. Check if we should use cookies from a specific browser
    // Valid options: chrome, firefox, safari, edge, etc.
    const envBrowser = process.env.YTDLP_COOKIES_BROWSER;
    if (envBrowser) {
      return ["--cookies-from-browser", envBrowser];
    }

    return [];
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
        query,
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
        String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16)),
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
      const ytdlpPath = await this.resolveYtDlpPath();

      // Check if ffmpeg is installed
      try {
        await execAsync("ffmpeg -version");
      } catch (error) {
        throw new Error(
          "ffmpeg not found. Install with: brew install ffmpeg (Mac) or sudo apt install ffmpeg (Linux)",
        );
      }

      const timestamp = Date.now();
      const safeOutputName = outputName
        .replace(/[^a-z0-9]/gi, "_")
        .substring(0, 50);
      const outputPath = path.join(
        this.tempDir,
        `${safeOutputName}_${timestamp}`,
      );
      const finalPath = `${outputPath}.mp3`;

      console.log(`📥 Downloading: ${videoUrl}`);

      const baseCommand = ytdlpPath.includes(" ")
        ? ytdlpPath.split(" ")
        : [ytdlpPath];
      // Support proxy through env var for environments like PM2 where system proxy may differ
      const ytdlpProxy =
        process.env.YTDLP_PROXY || process.env.YTDLP_HTTP_PROXY || null;
      const proxyArg = ytdlpProxy ? ["--proxy", ytdlpProxy] : [];
      const cookiesArg = this.getCookiesArg();
      const fallbackUrls = this.buildYouTubeFallbackUrls(videoUrl);
      const attemptCommands = fallbackUrls.flatMap((candidateUrl) => [
        [
          ...baseCommand.slice(1),
          ...proxyArg,
          ...cookiesArg,
          "--ignore-config",
          "--force-ipv4",
          "-x",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "-o",
          `${outputPath}.%(ext)s`,
          candidateUrl,
        ],
        [
          ...baseCommand.slice(1),
          ...proxyArg,
          ...cookiesArg,
          "--ignore-config",
          "-x",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "-o",
          `${outputPath}.%(ext)s`,
          candidateUrl,
        ],
      ]);

      let lastAttemptError = null;
      let downloaded = false;
      for (const args of attemptCommands) {
        try {
          await new Promise((resolve, reject) => {
            // Preserve env but ensure NO_PROXY for local direct YouTube access; keep proxy flags passed to yt-dlp
            const spawnEnv = {
              ...process.env,
              NO_PROXY:
                process.env.NO_PROXY ||
                "youtube.com,www.youtube.com,m.youtube.com,youtu.be",
              no_proxy:
                process.env.no_proxy ||
                "youtube.com,www.youtube.com,m.youtube.com,youtu.be",
            };

            if (process.env.PM2_HOME) {
              // Helpful log when running under PM2 for debugging network issues
              console.log(
                `ℹ️ Running under PM2 (PM2_HOME=${process.env.PM2_HOME}), using YTDLP_PROXY=${ytdlpProxy || "none"}`,
              );
            }

            const downloadProcess = spawn(baseCommand[0], args, {
              cwd: process.cwd(),
              env: spawnEnv,
            });

            let stdout = "";
            let stderr = "";

            downloadProcess.stdout.on("data", (data) => {
              stdout += data.toString();
            });

            downloadProcess.stderr.on("data", (data) => {
              stderr += data.toString();
            });

            const timeoutId = setTimeout(() => {
              downloadProcess.kill("SIGKILL");
              reject(new Error("yt-dlp download timed out"));
            }, 120000);

            downloadProcess.on("close", (code) => {
              clearTimeout(timeoutId);
              if (code !== 0) {
                const error = new Error(`yt-dlp exited with code ${code}`);
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
              } else {
                resolve();
              }
            });

            downloadProcess.on("error", (error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
          });
          downloaded = true;
          break;
        } catch (error) {
          lastAttemptError = error;
          console.log(`⚠️ MP3 download attempt failed: ${error.message}`);
          if (error.stderr) {
            console.log(error.stderr);
          }
        }
      }

      if (!downloaded) {
        const networkHint = this.getYouTubeNetworkErrorMessage(
          videoUrl,
          lastAttemptError,
        );
        if (networkHint) {
          throw new Error(networkHint);
        }

        throw lastAttemptError || new Error("Download failed");
      }

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
        `thumb_${videoId}_${timestamp}.jpg`,
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
          path.join(process.cwd(), "venv/bin/yt-dlp"),
          "./venv/bin/yt-dlp",
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
        // Try Python module as last resort
        if (!found) {
          try {
            await execAsync("python3 -m yt_dlp --version");
            ytdlpPath = "python3 -m yt_dlp";
            found = true;
          } catch {}
        }
        if (!found) {
          throw new Error(
            "yt-dlp not installed. Install with: brew install yt-dlp (Mac) or pip install yt-dlp",
          );
        }
      }

      // Check if ffmpeg is installed
      try {
        await execAsync("ffmpeg -version");
      } catch (error) {
        throw new Error(
          "ffmpeg not found. Install with: brew install ffmpeg (Mac) or sudo apt install ffmpeg (Linux)",
        );
      }

      if (progressCallback) progressCallback(5, "🔍 Starting download...");

      // Try to update yt-dlp first (silent fail if it doesn't work)
      try {
        console.log("⬆️  Checking for yt-dlp updates...");
        // Only use -U flag if not using Python module form
        if (ytdlpPath.includes("python3 -m")) {
          await execAsync("python3 -m pip install --upgrade yt-dlp", {
            timeout: 30000,
          });
        } else {
          await execAsync(`${ytdlpPath} -U`, { timeout: 30000 });
        }
        console.log("✅ yt-dlp updated successfully");
      } catch (updateError) {
        console.log(
          "ℹ️  Could not auto-update yt-dlp, trying manual update...",
        );
        try {
          await execAsync("pip3 install --upgrade yt-dlp", { timeout: 30000 });
          console.log("✅ yt-dlp updated via pip3");
        } catch (pipError) {
          console.log(
            "⚠️  Auto-update failed, continuing with current version",
          );
        }
      }

      // Normalize URL for YouTube Shorts
      let normalizedUrl = videoUrl;
      if (videoUrl.includes("/shorts/")) {
        const shortIdMatch = videoUrl.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
        if (shortIdMatch) {
          normalizedUrl = `https://www.youtube.com/watch?v=${shortIdMatch[1]}`;
          console.log(`🔄 Converted Shorts URL: ${normalizedUrl}`);
        }
      }

      const fallbackUrls = this.buildYouTubeFallbackUrls(normalizedUrl);

      // Support proxy through env var for PM2/systemd environments
      const ytdlpProxy =
        process.env.YTDLP_PROXY || process.env.YTDLP_HTTP_PROXY || null;
      const proxyArg = ytdlpProxy ? ["--proxy", ytdlpProxy] : [];
      const cookiesArg = this.getCookiesArg();

      const timestamp = Date.now();
      const safeTitle = `video_${timestamp}`;
      const outputPath = path.join(this.tempDir, safeTitle);
      const finalPath = `${outputPath}.mp4`;

      // Extract video ID for thumbnail
      let videoId =
        normalizedUrl.match(/[?&]v=([^&]+)/)?.[1] ||
        normalizedUrl.match(/youtu\.be\/([^?&]+)/)?.[1] ||
        normalizedUrl.match(/shorts\/([^?&]+)/)?.[1] ||
        timestamp.toString();

      if (progressCallback) progressCallback(10, "⬇️ Downloading video...");

      console.log(`📥 Downloading video from URL`);
      console.log(`🔗 URL: ${normalizedUrl}`);

      // Prefer web client to avoid Android PO-token requirement, then fall back if needed.
      const baseCommand = ytdlpPath.split(" ");
      const attemptArgsList = fallbackUrls.flatMap((candidateUrl) => [
        [
          ...baseCommand.slice(1),
          ...proxyArg,
          ...cookiesArg,
          "--force-ipv4",
          "--extractor-args",
          "youtube:player_client=web;player_skip=webpage,configs",
          "-f",
          "b[height<=720]/best[height<=720]/b/best",
          "--merge-output-format",
          "mp4",
          "-o",
          `${outputPath}.%(ext)s`,
          "--newline",
          candidateUrl,
        ],
        [
          ...baseCommand.slice(1),
          ...proxyArg,
          ...cookiesArg,
          "--force-ipv4",
          "--extractor-args",
          "youtube:player_client=web;player_skip=webpage,configs",
          "-f",
          "b[height<=720]/best[height<=720]/b/best",
          "--merge-output-format",
          "mp4",
          "-o",
          `${outputPath}.%(ext)s`,
          "--newline",
          candidateUrl,
        ],
        [
          ...baseCommand.slice(1),
          ...proxyArg,
          ...cookiesArg,
          "--force-ipv4",
          "--extractor-args",
          "youtube:player_client=web",
          "-f",
          "b[height<=720]/best[height<=720]/b/best",
          "--merge-output-format",
          "mp4",
          "-o",
          `${outputPath}.%(ext)s`,
          "--newline",
          candidateUrl,
        ],
        [
          ...baseCommand.slice(1),
          ...proxyArg,
          ...cookiesArg,
          "--force-ipv4",
          "-f",
          "b[height<=720]/best[height<=720]/b/best",
          "--merge-output-format",
          "mp4",
          "-o",
          `${outputPath}.%(ext)s`,
          "--newline",
          candidateUrl,
        ],
      ]);

      const runDownloadAttempt = (args) =>
        new Promise((resolve, reject) => {
          const spawnEnv = {
            ...process.env,
            NO_PROXY:
              process.env.NO_PROXY ||
              "youtube.com,www.youtube.com,m.youtube.com,youtu.be",
            no_proxy:
              process.env.no_proxy ||
              "youtube.com,www.youtube.com,m.youtube.com,youtu.be",
          };

          if (process.env.PM2_HOME) {
            console.log(
              `ℹ️ Running under PM2 (PM2_HOME=${process.env.PM2_HOME}), using YTDLP_PROXY=${ytdlpProxy || "none"}`,
            );
          }

          const downloadProcess = spawn(baseCommand[0], args, {
            cwd: process.cwd(),
            env: spawnEnv,
          });

          let lastProgress = 10;

          downloadProcess.stdout.on("data", (data) => {
            const output = data.toString();
            console.log(output);

            const progressMatch = output.match(/(\d+\.?\d*)%/);
            if (progressMatch && progressCallback) {
              const percent = parseFloat(progressMatch[1]);
              const mappedPercent = 10 + percent * 0.8;
              if (mappedPercent > lastProgress) {
                lastProgress = mappedPercent;
                progressCallback(
                  Math.round(mappedPercent),
                  `⬇️ Downloading... ${percent.toFixed(1)}%`,
                );
              }
            }
          });

          downloadProcess.stderr.on("data", (data) => {
            const output = data.toString();
            console.log(output);

            const progressMatch = output.match(/(\d+\.?\d*)%/);
            if (progressMatch && progressCallback) {
              const percent = parseFloat(progressMatch[1]);
              const mappedPercent = 10 + percent * 0.8;
              if (mappedPercent > lastProgress) {
                lastProgress = mappedPercent;
                progressCallback(
                  Math.round(mappedPercent),
                  `⬇️ Downloading... ${percent.toFixed(1)}%`,
                );
              }
            }
          });

          downloadProcess.on("close", (code) => {
            if (code !== 0) {
              reject(new Error(`yt-dlp exited with code ${code}`));
            } else {
              resolve();
            }
          });

          downloadProcess.on("error", (error) => {
            reject(error);
          });
        });

      let downloaded = false;
      let lastAttemptError = null;
      for (const args of attemptArgsList) {
        try {
          console.log(`📝 Running: ${baseCommand[0]} ${args.join(" ")}`);
          await runDownloadAttempt(args);
          downloaded = true;
          break;
        } catch (attemptError) {
          lastAttemptError = attemptError;
          console.log(`⚠️ Download attempt failed: ${attemptError.message}`);
        }
      }

      if (!downloaded) {
        const networkHint = this.getYouTubeNetworkErrorMessage(
          normalizedUrl,
          lastAttemptError,
        );
        if (networkHint) {
          throw new Error(networkHint);
        }

        throw lastAttemptError || new Error("yt-dlp download failed");
      }

      if (progressCallback) progressCallback(90, "✅ Download complete!");

      // Check if file exists
      if (!fs.existsSync(finalPath)) {
        throw new Error("Download failed - video file not created");
      }

      const stats = fs.statSync(finalPath);
      const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`✅ Downloaded: ${fileSizeMB} MB`);

      // Download thumbnail with progress
      if (progressCallback) progressCallback(95, "📸 Getting thumbnail...");
      const thumbnail = await this.downloadThumbnail(videoId);

      if (progressCallback) progressCallback(100, "🎉 Ready to send!");

      return {
        filepath: finalPath,
        title: "Video",
        thumbnail: thumbnail,
        size: fileSizeMB,
        cleanup: () => {
          if (fs.existsSync(finalPath)) {
            fs.unlinkSync(finalPath);
            console.log(`🗑️  Cleaned up: ${finalPath}`);
          }
          if (
            thumbnail &&
            thumbnail.filepath &&
            fs.existsSync(thumbnail.filepath)
          ) {
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
   * Resolve YouTube title without downloading media.
   * @param {string} videoUrl - YouTube video URL
   * @returns {Promise<string|null>} Video title or null when unavailable
   */
  async getVideoTitle(videoUrl) {
    try {
      const ytdlpPath = await this.resolveYtDlpPath();
      const cookiesArg = this.getCookiesArg().join(" ");
      const proxyArg = process.env.YTDLP_PROXY ? `--proxy "${process.env.YTDLP_PROXY}"` : "";

      const titleCommands = [
        `${ytdlpPath} --no-playlist --skip-download ${proxyArg} ${cookiesArg} --force-ipv4 --extractor-args "youtube:player_client=web;player_skip=webpage,configs" --print "%(title)s" "${videoUrl}"`,
        `${ytdlpPath} --no-playlist --skip-download ${proxyArg} ${cookiesArg} --force-ipv4 --extractor-args "youtube:player_client=web" --print "%(title)s" "${videoUrl}"`,
        `${ytdlpPath} --no-playlist --skip-download ${proxyArg} ${cookiesArg} --force-ipv4 --print "%(title)s" "${videoUrl}"`,
        `${ytdlpPath} --no-playlist --skip-download ${proxyArg} ${cookiesArg} --extractor-args "youtube:player_client=web;player_skip=webpage,configs" --print "%(title)s" "${videoUrl}"`,
      ];

      for (const command of titleCommands) {
        try {
          const { stdout } = await execAsync(command, { timeout: 30000 });
          const title = (stdout || "").trim().split("\n").filter(Boolean)[0];
          if (title) {
            return title;
          }
        } catch (error) {
          console.log(
            "⚠️ Could not fetch video title with IPv4 fallback:",
            error?.message || error,
          );
        }
      }

      return null;
    } catch (error) {
      console.log("⚠️ Could not fetch video title:", error?.message || error);
      return null;
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
