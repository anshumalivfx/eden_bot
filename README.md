# Eden - Your Sarcastic WhatsApp Companion

Meet **Eden** - a sarcastic WhatsApp bot that responds to commands with mean (but hilarious) human-like responses using **FREE** Large Language Models!

## ✨ Features

- 🔥 **Sarcastic Personality**: Eden roasts users with witty, clever responses
- 📱 **No Business API**: Uses `whatsapp-web.js` (unofficial but reliable)  
- 🆓 **FREE LLMs**: Multiple free AI providers (Groq, Hugging Face, Ollama)
- 🎯 **Command-Based**: Responds only to messages starting with `-`
- 💬 **Group Chat Ready**: Perfect for WhatsApp groups
- 😈 **Mean but Funny**: Clever insults without being offensive
- 🎨 **Sticker Creation**: Convert images/GIFs/videos to WhatsApp stickers
- 🎤 **Voice Messages**: Text-to-speech with 6 hilarious personalities (NEW!)
- 🎭 **Dynamic Moods**: Personality changes throughout the day
- 👑 **Name Triggers**: Responds when mentioned by name

- 🔥 **Sarcastic Personality**: Eden roasts users with witty, clever responses
- 📱 **No Business API**: Uses `whatsapp-web.js` (unofficial but reliable)  
- � **FREE LLMs**: Multiple free AI providers (Groq, Hugging Face, Ollama)
- �🎯 **Command-Based**: Responds only to messages starting with `-`
- 💬 **Group Chat Ready**: Perfect for WhatsApp groups
- 😈 **Mean but Funny**: Clever insults without being offensive

## 🆓 Free LLM Options

Eden supports multiple **completely FREE** AI providers:

### 🥇 Groq (Recommended)
- ✅ **100% Free** with great performance
- ✅ Fast responses  
- ✅ Easy setup
- 🔗 [Get free API key](https://console.groq.com/)

### 🏠 Ollama (Local)
- ✅ **Completely free** and private
- ✅ Works offline
- ✅ No API limits
- 📦 Install: `brew install ollama`

### 🤗 Others
- **Hugging Face**: Free tier available
- **Cohere**: Free developer access

📖 **Detailed setup guide:** [FREE_LLM_SETUP.md](FREE_LLM_SETUP.md)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Edit `.env` file and add your API keys:

```env
# Choose ONE of these LLM options:

# Option 1: OpenAI (paid, best quality)
OPENAI_API_KEY=your_openai_api_key_here

# Option 2: Groq (free, good quality)
GROQ_API_KEY=your_groq_api_key_here

# Option 3: Ollama (local, free, requires setup)
OLLAMA_URL=http://localhost:11434
```

### 3. LLM Setup Options

#### Option A: OpenAI (Recommended for best results)
1. Get API key from [OpenAI](https://platform.openai.com/api-keys)
2. Add to `.env` file

#### Option B: Groq (Free alternative)
1. Get free API key from [Groq](https://console.groq.com/)
2. Add to `.env` file

#### Option C: Ollama (Local, completely free)
1. Install Ollama: `brew install ollama` (macOS)
2. Run: `ollama pull llama2`
3. Start: `ollama serve`

### 4. Start the Bot

```bash
npm start
```

### 5. Scan QR Code

1. A QR code will appear in your terminal
2. Scan it with your WhatsApp mobile app
3. Bot is now ready to use!

## Commands

All commands start with `-` (configurable in `.env`)

### Basic Commands
- `-help` or `-h` - Show help
- `-ask [question]` - Ask anything
- `-roast` - Get roasted
- `-joke` - Get a mean joke
- `-insult [target]` - Insult someone/something
- `-sarcasm [topic]` - Be sarcastic about something

### Advanced Commands
- `-burn [person]` - Burn someone specific
- `-savage [message]` - Get savage response
- `-rate [thing]` - Rate stupidity level
- `-sticker` or `-s2` - Create stickers from media/text
- `-voice [text]` or `-v` - Create funny voice messages (NEW! 🎤)

### Voice Features
- **6 Personalities**: sarcastic, dramatic, robot, posh, excited, sleepy
- **Reply Support**: Reply to any message with `-voice` to speak it
- **Smart Processing**: Handles emojis, links, and long messages
- **Multiple Aliases**: `-v`, `-speak`, `-tts` all work

### Examples
```
-ask what's the weather like?
-roast
-insult my homework
-sarcasm people who don't read documentation
-burn that guy who never replies
-savage your excuse for being late
-rate pineapple on pizza
-sticker (reply to image/text)
-voice Hello everyone!
-voice dramatic This is amazing!
-v robot BEEP BOOP human detected
```

## How It Works

1. **Message Detection**: Bot listens for messages starting with `-`
2. **Command Parsing**: Extracts command and arguments
3. **LLM Generation**: Sends to configured LLM with "mean personality" prompt
4. **Response**: Replies with generated sarcastic response

## Customization

### Change Command Prefix
Edit `.env`:
```env
COMMAND_PREFIX=!
```

### Modify Personality
Edit `services/llmService.js` and modify the `meanPersonality` prompt.

### Add New Commands
Edit `handlers/commandHandler.js` and add to the `commands` object.

## Security & Privacy

- ✅ No data stored on external servers (except LLM API calls)
- ✅ Uses local WhatsApp Web session
- ✅ No message logging by default
- ⚠️ LLM API calls send message content to chosen provider

## Troubleshooting

### Bot Not Responding
1. Check if QR code was scanned properly
2. Verify phone has internet connection
3. Check console for errors

### LLM Errors
1. Verify API keys are correct
2. Check API quotas/limits
3. Try fallback responses (built-in)

### WhatsApp Disconnects
- Bot will attempt to reconnect automatically
- May need to rescan QR code occasionally

## Development

```bash
# Development mode with auto-restart
npm run dev
```

## Contributing

Feel free to contribute by:
- Adding new commands
- Improving personality prompts
- Adding more LLM providers
- Bug fixes and improvements

## Disclaimer

This bot is for entertainment purposes. Be respectful and don't use it to genuinely hurt people's feelings. The "meanness" should be playful and witty, not actually offensive.

## License

MIT License - Feel free to use and modify!
# eden_bot
