# 🤖 Eden Bot - Agent Customization Guide

This guide helps AI agents understand the codebase structure, conventions, and development patterns used in the Eden WhatsApp bot project.

## 📋 Project Overview

**Eden** is a sarcastic WhatsApp bot built with Baileys (@whiskeysockets/baileys) that responds to commands, mentions, and replies with witty humor. Key characteristics:
- Command prefix: `-` (configurable via `COMMAND_PREFIX` in `.env`)
- Free LLM integration (Groq, Ollama, HuggingFace, Cohere, or OpenAI)
- Multi-modal responses (text, stickers, voice messages, images)
- SQLite-based message context storage for conversational awareness

## 🏗️ Core Architecture

### Main Entry Points
- **[index.js](index.js)** - Main bot initialization and message loop; handles Baileys socket setup, message routing, command execution, and mention/reply detection
- **[start.js](start.js)** - Pre-flight checks for .env configuration and LLM provider setup

### Key Services
- **[services/llmService.js](services/llmService.js)** - LLM response generation (provider fallback chain)
- **[services/youtubeService.js](services/youtubeService.js)** - YouTube video/audio download (yt-dlp based)
- **[services/stickerService.js](services/stickerService.js)** - Image/video-to-sticker conversion via Sharp/FFMPEG
- **[services/voiceService.js](services/voiceService.js)** - Text-to-speech with multiple personalities (piper/gtts)

### Command Processing
- **[handlers/commandHandler.js](handlers/commandHandler.js)** - Command dispatch and execution (~60+ commands including -pint)
- **[database/messageStore.js](database/messageStore.js)** - SQLite context storage for conversation history
- **[database/muteStore.js](database/muteStore.js)** - User/chat mute state
- **[database/banStore.js](database/banStore.js)** - User ban management

### Data Storage
- **baileys_auth/** - Baileys session state (authentication keys)
- **database/eden.db** - SQLite database for message context and user settings
- **nice-users.json** - Whitelist of users receiving special treatment
- **temp/** - Temporary files for processing (stickers, downloads, etc.)

## 🔴 Known Issues & Workarounds

### Pinterest Command (-pint) Reliability
**Status:** Partially working with fallback mechanism  
**Issue:** Direct Pinterest HTML scraping can fail (SSL errors, rate-limiting, DOM structure changes)

**Current Solution:**
- Primary: Scrape Pinterest.com for i.pinimg.com URLs via regex patterns
- Fallback: Parse Bing Images for i.pinimg.com URLs if Pinterest fails
- See: [handlers/commandHandler.js#L2730](handlers/commandHandler.js#L2730) (`sendPinterestImages` method)

**Testing the Pinterest Command:**
```bash
# Test with simple query
npm start
# In WhatsApp: -pint Manali

# Test with count
# In WhatsApp: -pint 6 Manali

# Enable debugging by adding console.logs in sendPinterestImages
```

**Debugging Tips:**
- Check if `axios` request completes (20s timeout set)
- Verify regex patterns match current HTML structure from Pinterest
- If Bing fallback triggers, verify `parseBingImagesForPinterestUrls` logic
- Common failure: Pinterest HTML structure changed → regex no longer matches

### YouTube Download Stability
**Issue:** Format availability varies by device client type  
**Solution:** Use web/default player_client, NOT android (which may require PO token)  
See: [services/youtubeService.js](services/youtubeService.js)

### Video Send Failures
**Workaround:** After successful download, try sending as video first, fallback to document  
See: [index.js](index.js) command response media send logic

### Message Handling Conventions
- **senderJid scope:** Declare early in message loops; avoid redeclaration in nested blocks (causes SyntaxError)
- **Nice users:** Check via `isNiceUser(jid)` helper; filters on phone number portion of JID
- **isNiceUser scope:** Keep scoped in catch blocks to prevent undefined reference crashes

### Mention/Reply Cooldowns
All special mentions (Heikki, Yousef) use per-chat cooldowns stored in Maps:
- **Heikki berserk:** 20-minute cooldown (prevents spam retriggers in same chat)
- **Yousef berserk:** 20-minute cooldown (positive praise mode)
- **Horse excitement:** 10-minute cooldown per chat
- Maps: `heikkiCooldowns`, `yousefCooldowns`, `horseCooldowns`

## 🔧 Development Conventions

### Command Naming
Commands are prefixed with `-` and map to methods in `CommandHandler`:
```javascript
// In commandHandler.js command registry (~line 106)
pint: this.sendPinterestImages.bind(this),
```

### Error Handling Pattern
Always include try-catch with fallback messaging:
```javascript
try {
  // Command logic
} catch (error) {
  console.error("❌ Command name error:", error);
  return "❌ Something went wrong. Try again later.";
}
```

### Media Processing
- Use **Sharp** for image operations (fast, efficient)
- Use **FFmpeg** for video operations (via fluent-ffmpeg)
- Always place generated files in **temp/** directory
- Clean up temp files after send to prevent disk bloat

### LLM Service Fallback
LLMService tries providers in order (defined in constructor):
1. Groq (if `GROQ_API_KEY` set)
2. OpenAI (if `OPENAI_API_KEY` set)
3. Ollama (if `OLLAMA_URL` set)
4. HuggingFace (if `HUGGINGFACE_API_KEY` set)
5. Cohere (if `COHERE_API_KEY` set)
6. Fallback: Generic response

## 📂 File Organization Rules

- **handlers/** - Command dispatch logic only (no service implementations)
- **services/** - Reusable service modules (LLM, YouTube, Stickers, Voice)
- **database/** - SQLite store classes and data management
- **temp/** - Auto-generated files (cleaned periodically)
- **scripts/** - Setup/utility scripts (setup.sh, recovery.sh, etc.)
- **assets/** - Static images for stickers or profiles

## 🛠️ Common Development Tasks

### Adding a New Command
1. Implement method in `CommandHandler` (async, returns string response)
2. Register in command map (~line 90): `mycommand: this.myCommandMethod.bind(this)`
3. Add help text in `getHelpMessage()` method
4. Test: `npm start` → send `-mycommand args` in WhatsApp

### Debugging Message Flow
1. Add console.logs in [index.js](index.js) message loop
2. Check `senderJid`, `messageText`, and command parsing
3. Verify command exists in registry before execution
4. Enable SQLite logging for context retrieval

### Testing Pinterest Command
```bash
# Run the bot
npm start

# In any WhatsApp chat:
-pint Manali          # Uses default (4 images)
-pint 6 Manali        # Custom count (6 images)
-pint 15 Manali       # Will fail (max 10) and show error
```

## ⚙️ Configuration

- `.env` file controls: LLM keys, command prefix, bot name, log levels
- Environment variables override defaults
- See [start.js](start.js) for validation logic

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| [README.md](README.md) | User-facing feature overview |
| [FEATURES_COMPLETE.md](FEATURES_COMPLETE.md) | Complete feature list with examples |
| [MENTION_REPLY_FEATURE.md](MENTION_REPLY_FEATURE.md) | Mention & reply system details |
| [STICKER_GUIDE.md](STICKER_GUIDE.md) | Sticker creation features |
| [VOICE_GUIDE.md](VOICE_GUIDE.md) | Voice message personalities |
| [FREE_LLM_SETUP.md](FREE_LLM_SETUP.md) | LLM provider setup instructions |
| [RASPBERRY_PI_SETUP.md](RASPBERRY_PI_SETUP.md) | RPi-specific deployment guide |

## 🐛 Troubleshooting Quick Reference

| Problem | Location | Solution |
|---------|----------|----------|
| `-pint` returns no results | [commandHandler.js#L2730](handlers/commandHandler.js#L2730) | Check fallback to Bing, verify regex patterns |
| Video download fails | [youtubeService.js](services/youtubeService.js) | Use web client, not android |
| Bot crashes on send | [index.js](index.js) | Check senderJid scope, add video→document fallback |
| LLM not responding | [services/llmService.js](services/llmService.js) | Verify .env keys, check provider fallback chain |
| Message context missing | [database/messageStore.js](database/messageStore.js) | Check SQLite DB permissions, enable logging |

---

**Last Updated:** May 2026 | **Version:** 1.0  
For detailed API behavior and edge cases, refer to inline comments in respective files.
