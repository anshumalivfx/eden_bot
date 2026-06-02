# 🎵 YouTube Music Download Feature

## Overview
Eden can now download songs from YouTube and send them as MP3 files! Just use the `-play` command with a song name.

## ⚠️ IMPORTANT LEGAL NOTICE

**Before using this feature, please read:**

1. **YouTube Terms of Service**: Downloading videos from YouTube violates their Terms of Service unless you have explicit permission from the content owner.

2. **Copyright Laws**: Downloading copyrighted music without permission may be illegal in your jurisdiction.

3. **Intended Use**: This feature should ONLY be used for:
   - Content you own
   - Creative Commons licensed content
   - Content where you have explicit permission to download
   - Educational purposes in compliance with fair use laws

4. **Your Responsibility**: By using this feature, you agree to:
   - Comply with all applicable laws
   - Respect copyright holders' rights
   - Use it only for legally permissible purposes
   - Take full responsibility for your usage

**The developer is not responsible for any misuse of this feature.**

---

## 🚀 Setup

### 1. Install yt-dlp

**macOS (using Homebrew):**
```bash
brew install yt-dlp
```

**Linux (using pip):**
```bash
pip install yt-dlp
# or
sudo pip install yt-dlp
```

**Other methods:**
```bash
# Using curl (Linux/Mac)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Using wget (Linux)
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### 2. Verify Installation

```bash
yt-dlp --version
```

You should see a version number like `2024.11.08` or similar.

### 3. That's it!

Eden will now be able to download music!

---

## 📱 Usage

### Basic Command

```
-play [song name]
```

### Examples

**Example 1: Bollywood Song**
```
User: -play Tera hone laga hoon
Eden: 🔍 Fine, searching for "Tera hone laga hoon"... This better be worth my time.
Eden: 🎵 Tera Hone Laga Hoon - Official Video
      Here's your music. You're welcome. 🎵
      [Sends MP3 file]
```

**Example 2: English Song**
```
User: -play Shape of You
Eden: 🔍 Fine, searching for "Shape of You"...
Eden: 🎵 Ed Sheeran - Shape of You
      Downloaded. Try not to play it on repeat... 🙄
      [Sends MP3 file]
```

**Example 3: Using Aliases**
```
-song Despacito
-music Bohemian Rhapsody
-play Never Gonna Give You Up
```

### In Group Chats

The bot will send the music to the entire group:

```
[Group: Music Lovers]
Alice: -play Losing My Religion
Eden: 🔍 Fine, searching for "Losing My Religion"...
Eden: 🎵 R.E.M. - Losing My Religion
      Your song is ready. My taste in music > yours btw. 💅
      [Sends MP3 to group]
```

---

## 🎭 Eden's Responses

Eden will respond with her signature sass:

- "Here's your music. You're welcome. 🎵"
- "Downloaded. Try not to play it on repeat... oh who am I kidding. 🙄"
- "Your song is ready. My taste in music > yours btw. 💅"
- "Here. Now stop asking me to be your DJ. 🎧"
- "Downloaded your request. This better be good. 😒"
- "Song delivered. I'm basically Spotify now. Ugh. 🎶"

---

## 🔧 How It Works

1. **Search**: Bot searches YouTube for your query
2. **Find**: Gets the top result
3. **Download**: Downloads video using yt-dlp
4. **Convert**: Extracts audio and converts to MP3
5. **Send**: Sends the MP3 file to chat
6. **Cleanup**: Automatically deletes temp files after 10 minutes

---

## 📊 Technical Details

### File Management
- MP3 files are saved to `temp/` directory
- Files are automatically cleaned up after 10 minutes
- Maximum download time: 2 minutes
- Audio quality: High (320kbps when available)

### Limitations
- **File Size**: WhatsApp has a 16MB limit for media
- **Length**: Very long videos may fail or be too large
- **Availability**: Video must be available in your region
- **Format**: Only outputs MP3 audio

### Error Handling

**yt-dlp not installed:**
```
Eden: Ugh, I can't download music without yt-dlp installed. 🙄

Install it first:
• Mac: brew install yt-dlp
• Linux: pip install yt-dlp
```

**Song not found:**
```
Eden: Couldn't find "sdkfjhsdf" on YouTube. 
      Maybe try spelling it correctly? 🤔
```

**Download failed:**
```
Eden: Well that didn't work. YouTube's probably judging 
      your music taste too. 🙄
```

---

## 🎯 Best Practices

### Do:
✅ Use specific song names with artist
✅ Check that yt-dlp is installed and updated
✅ Be patient - downloads take 10-30 seconds
✅ Only download content you have rights to

### Don't:
❌ Download copyrighted content without permission
❌ Spam the command repeatedly
❌ Try to download very long videos (1+ hour)
❌ Share downloaded copyrighted content

---

## 🐛 Troubleshooting

### "yt-dlp not installed"
Install yt-dlp using the instructions above.

### "Download failed"
- Check your internet connection
- Verify the video is available in your region
- Try a different search query
- Update yt-dlp: `brew upgrade yt-dlp` or `pip install -U yt-dlp`

### "Sign in to confirm you're not a bot"
YouTube has aggressive bot detection. To fix this:

1. **Get your cookies**:
   - Install the "Get cookies.txt LOCALLY" extension in Chrome/Firefox.
   - Go to YouTube and log in.
   - Use the extension to export your cookies as `cookies.txt`.
   - Place this `cookies.txt` file in the project root directory.

2. **Alternative: Environment Variable**:
   - You can also specify a custom path in your `.env` file:
     ```
     YTDLP_COOKIES_PATH=/path/to/your/cookies.txt
     ```

3. **Alternative: Use Browser Cookies (Local only)**:
   - If running locally (not on a headless server), you can tell Eden to use your browser's cookies directly by adding this to `.env`:
     ```
     YTDLP_COOKIES_BROWSER=chrome
     ```
     (Options: chrome, firefox, safari, edge)

### File too large
WhatsApp limits media to 16MB. Try:
- Shorter songs
- Different versions of the song

### Slow downloads
- Normal for first-time downloads
- Depends on your internet speed
- YouTube server speeds vary

---

## 🔄 Updates

### Keep yt-dlp Updated

YouTube changes frequently, so keep yt-dlp updated:

```bash
# macOS
brew upgrade yt-dlp

# Linux/pip
pip install -U yt-dlp
```

---

## 💡 Tips

1. **Be Specific**: "Shape of You Ed Sheeran" works better than just "Shape"
2. **Include Artist**: Helps find the right version
3. **Check Spelling**: Typos will return wrong results
4. **Popular Songs**: Generally download faster
5. **Live Versions**: Specify if you want live or studio

---

## 📝 Example Session

```
User: -play Blinding Lights
Eden: 🔍 Fine, searching for "Blinding Lights"... 
      This better be worth my time.

[Bot downloads...]

Eden: 🎵 The Weeknd - Blinding Lights (Official Audio)
      
      Here's your music. You're welcome. 🎵
      
      🔗 https://youtube.com/watch?v=...
      
[Sends MP3 file - 3.5 MB]

User: Thanks Eden!
Eden: Whatever. Don't make this a habit. 🙄
```

---

## ⚖️ Legal Reminder

**Use this feature responsibly and legally.**

- Respect copyright laws
- Respect artists' rights
- Support artists by purchasing music legally
- Use streaming services for general listening
- Only download content you have permission to download

This feature is provided for educational purposes and legal use cases only.

---

**Made with 😈 by Eden - Your Sarcastic Music DJ (apparently)**
