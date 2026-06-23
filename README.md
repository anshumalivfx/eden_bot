# 🤖 Eden Bot - AI WhatsApp Companion

A feature-rich WhatsApp bot built with **[Baileys](https://github.com/WhiskeySockets/Baileys)** that chats like a real person and packs 50+ commands. Eden replies naturally when mentioned or replied to, runs on **free LLMs** (no paid APIs required), and self-hosts comfortably on a Raspberry Pi.

## 📋 Features

- 💬 **Natural Conversations** - Responds when mentioned, @-tagged, or replied to, in groups and DMs
- 🧠 **Context-Aware Memory** - Per-user conversation history stored in SQLite for coherent, on-topic replies
- 🎭 **Dynamic LLM Personality** - Warm, expressive, human-like replies (not robotic) with real moods
- 🎨 **Stickers** - Convert images, videos, and text to stickers
- 🖼️ **AI Images** - Image generation, upscaling, and transformation
- 👁️ **Vision** - Understands images sent to it (Llama-4 Scout, Gemini)
- 🎤 **Speech-to-Text** - Transcribes voice notes in 29+ languages (Whisper)
- 🗣️ **Text-to-Speech** - Voice messages via Piper / gTTS
- 📥 **Media Tools** - YouTube audio download, Pinterest image search
- 🛡️ **Group Moderation** - Ban, mute, warn, kick, AFK tracking
- 📊 **Polls & Utilities** - Polls, stats, ping, and more
- 🆓 **Free LLM Stack** - Groq, Mistral, Ollama, HuggingFace, Cohere with automatic provider fallback

## 🛠️ Installation

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```

2. **Configure environment** - copy `.env` and add your free API keys (at minimum a Groq key):
   ```bash
   GROQ_API_KEY=your_groq_key        # free at console.groq.com
   # Optional fallbacks: MISTRAL_API_KEY, HUGGINGFACE_API_KEY, COHERE_API_KEY, OLLAMA_URL
   COMMAND_PREFIX=-                  # command prefix (default "-")
   ```

3. **Run the bot:**
   ```bash
   npm start
   ```

4. **Scan the QR code** with WhatsApp on your phone:
   - Open WhatsApp → Settings → Linked Devices → Link a Device
   - Scan the QR code shown in your terminal

   The session is saved to `baileys_auth/` (git-ignored) so you only scan once.

## 🚀 Getting Started

**Chat with Eden** - just talk to her naturally. She replies when you mention her name, @-tag her, or reply to one of her messages:

```
You: Hi Eden
Eden: hey hey whats up 😄

You: Eden how are you?
Eden: pretty good honestly! just chilling. you?
```

**Use commands** - prefix any command with `-`. Start with `-help` to see everything:

```
-help                 # list all commands
-sticker              # reply to an image/video to make a sticker
-imagine a red panda  # generate an AI image
-transcribe / -tb     # reply to a voice note to transcribe it
-ask <question>       # ask anything
-play <song>          # download audio from YouTube
```

## 📱 Commands

Eden has 50+ commands (with aliases). Run `-help` in chat for the full, always-current list. A sample:

| Category | Commands |
|----------|----------|
| Chat / Fun | `-ask` `-roast` `-joke` `-insult` `-sarcasm` `-rate` `-compliment` `-advice` `-fact` `-quote` |
| Media | `-sticker` `-take` `-meme` `-imagine` `-draw` `-upscale` `-transform` `-reimagine` `-pint` |
| Voice | `-voice` `-tts` `-speak` `-dub` `-transcribe` / `-tb` |
| Downloads | `-play` `-song` `-yt` |
| Social | `-hug` `-kiss` `-pat` `-slap` `-poke` `-cuddle` (and more reactions) |
| Utility | `-help` `-ping` `-status` `-stats` `-afk` `-poll` `-sys` |
| Moderation | `-ban` `-unban` `-mute` `-unmute` `-warn` `-kick` `-clean` |

## 🔧 Project Structure

```
eden/
├── index.js                 # Main bot: connection, message loop, reply logic
├── start.js                 # Entry point (npm start)
├── handlers/
│   └── commandHandler.js    # Command registry + all command implementations
├── services/                # LLM, image, sticker, voice/dub, YouTube, etc.
│   ├── llmService.js        # Multi-provider LLM with fallback chain
│   ├── dubService.js        # Whisper STT + Piper/gTTS TTS + dubbing
│   ├── imageService.js      # AI image generation
│   └── stickerService.js    # Sticker creation
├── database/
│   └── messageStore.js      # SQLite (better-sqlite3) conversation memory
├── baileys_auth/            # WhatsApp session (git-ignored)
└── package.json
```

### Adding a New Command

Commands live in `handlers/commandHandler.js`. Register the command name in the `this.commands` registry (constructor) and implement the method:

```javascript
// In the this.commands = { ... } registry
mycommand: this.myCommand.bind(this),

// Then add the method on the class
async myCommand(args, message) {
  return "Command response";
}
```

The handler maps the `-mycommand` text to your method automatically; aliases are just extra keys pointing to the same method.

## 📦 Tech Stack

- **[Baileys](https://github.com/WhiskeySockets/Baileys)** - WhatsApp Web (multi-device) API
- **better-sqlite3** - per-user conversation memory
- **Groq SDK** + **Mistral / HuggingFace / Cohere / Ollama** - free LLM providers
- **@google/generative-ai** - Gemini (vision / fallback)
- **Whisper** (Groq `whisper-large-v3` + local `faster-whisper`) - speech-to-text
- **Piper TTS / gTTS** - text-to-speech
- **fluent-ffmpeg** + **ffmpeg-static** - audio/video processing
- **Sharp / Jimp / node-webpmux** - image & sticker processing
- **axios**, **pino**, **qrcode-terminal**, **dotenv**

## ⚙️ Configuration

Key environment variables (`.env`):

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Primary free LLM + Whisper transcription |
| `MISTRAL_API_KEY` / `HUGGINGFACE_API_KEY` / `COHERE_API_KEY` | Fallback LLM providers |
| `OLLAMA_URL` | Local LLM endpoint (default `http://localhost:11434`) |
| `GEMINI_API_KEY` | Google Gemini (vision / fallback) |
| `COMMAND_PREFIX` | Command prefix (default `-`) |
| `DUB_TRANSCRIPTION_ENGINE` | `groq` (free, best multilingual) or `whisper-local` |
| `WHISPER_MODEL` | Local Whisper model: `tiny` / `base` / `small` |

## 🚀 Deployment

### Raspberry Pi (memory-limited)
```bash
npm run start:rpi      # caps Node heap at 512MB; uses RPi-tuned Whisper model
```

### Production with PM2 (recommended)
```bash
npm install -g pm2
pm2 start start.js --name eden-bot
pm2 save
pm2 startup
```

### Development
```bash
npm run dev            # nodemon auto-reload
```

## 🐛 Troubleshooting

**QR code / login issues** - delete the `baileys_auth/` folder and restart to re-link.

**Bot not responding** - confirm it's running, check terminal logs, and make sure at least one LLM key (e.g. `GROQ_API_KEY`) is set.

**Transcription fails** - set `DUB_TRANSCRIPTION_ENGINE=groq` with a valid `GROQ_API_KEY`, or install local Whisper (`pip install faster-whisper`) for offline use.

**Sticker/voice issues** - ensure `ffmpeg` works (bundled via `ffmpeg-static`); very large media may take longer to process.

## 📄 License

ISC

---

Made with ❤️ using Baileys
