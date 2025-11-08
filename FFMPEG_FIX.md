# 🔧 Quick Fix: ffmpeg Missing Error

## The Problem

You got this error:
```
ERROR: Postprocessing: ffprobe and ffmpeg not found.
```

This means `yt-dlp` successfully downloaded the video but can't convert it to MP3 without `ffmpeg`.

## The Solution

Install **ffmpeg**:

### macOS (Homebrew)
```bash
brew install ffmpeg
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install ffmpeg
```

### Linux (CentOS/Fedora)
```bash
sudo yum install ffmpeg
# or
sudo dnf install ffmpeg
```

### Verify Installation
```bash
ffmpeg -version
```

You should see version info like:
```
ffmpeg version 6.1.1
```

## After Installing

1. **Restart your bot** (if it's running)
2. Try the `-play` command again:
   ```
   -play Tera hone laga hoon
   ```

## What You Also Need

Make sure you have both:
- ✅ `yt-dlp` - Downloads videos from YouTube
- ✅ `ffmpeg` - Converts video to MP3

### Install Both at Once (macOS)
```bash
brew install yt-dlp ffmpeg
```

### Install Both at Once (Linux)
```bash
sudo apt install ffmpeg python3-pip
pip install yt-dlp
```

## Now It Should Work!

After installing ffmpeg, Eden will be able to:
1. Download videos from YouTube ✅
2. Convert them to MP3 ✅
3. Send them to your chats ✅

---

**Quick Summary:**
```bash
# macOS
brew install ffmpeg

# Linux
sudo apt install ffmpeg

# Then restart bot and try again!
```
