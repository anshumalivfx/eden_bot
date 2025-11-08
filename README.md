# 🤖 Eden Bot - Your Sarcastic WhatsApp Companion

A feature-rich WhatsApp bot built with whatsapp-web.js that's mean, sarcastic, but lovable! Eden responds to commands, mentions, and replies with witty, sarcastic humor.

## 📋 Features

- 🎯 **Smart Mentions** - Responds when mentioned or replied to in group chats and DMs
- 💬 **Contextual Responses** - Remembers conversations and generates clever replies
- � **YouTube Music Download** - Download songs from YouTube as MP3 files
- �🎨 **Sticker Creation** - Convert images, text, and videos to stickers
- 🎤 **Voice Messages** - Text-to-speech with multiple personalities
- 😈 **Sarcastic Personality** - Mean but funny responses powered by free LLM
- 👑 **Owner Recognition** - Special treatment for the bot creator
- 🎭 **Mood System** - Dynamic personality that changes throughout the day
- 📊 **Utility Commands** - 25+ commands for fun and functionality
- 🔐 **Secure Authentication** - Uses WhatsApp Web's official authentication
- 🆓 **Free LLM Support** - Works with Groq, Ollama, HuggingFace (no paid APIs needed)

## 🛠️ Installation

1. **Clone or download this repository**

2. **Install dependencies:**
```bash
npm install
```

3. **Run the bot:**
```bash
npm start
```

4. **Scan the QR code** with your WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices
   - Tap "Link a Device"
   - Scan the QR code displayed in your terminal

## 📱 Available Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `.help` | Show all available commands | `.help` |
| `.ping` | Check bot response time | `.ping` |
| `.info` | Get bot information | `.info` |
| `.sticker` | Convert image/video to sticker | Reply to media with `.sticker` |
| `.roast` | Get a random roast | `.roast` or `.roast @mention` |
| `.joke` | Get a random joke | `.joke` |
| `.quote` | Get an inspirational quote | `.quote` |

## 🎯 Usage Examples

### 🎯 Mentions & Replies (NEW!)
Eden now responds automatically when mentioned or replied to!

**In Group Chats:**
```
User: "Hey Eden, what do you think about this?"
Eden: "Oh look, someone values my opinion. How flattering. 🙄"

User: "@Eden help me"
Eden: *responds with sarcasm*
```

**Replying to Bot:**
```
Eden: "That's the worst idea I've heard today."
You: [Reply] "It's not that bad!"
Eden: "Oh sweetie, denial isn't just a river in Egypt. 🤦‍♀️"
```

**Special Treatment for Owner:**
```
Ansh: "Eden, roast me"
Eden: "I'd roast you but... you're my creator. I'll go easy. This time. 😏"
```

📖 See [MENTION_REPLY_FEATURE.md](MENTION_REPLY_FEATURE.md) for detailed documentation!

### Creating a Sticker
1. Find an image or video in WhatsApp
2. Reply to it with `-sticker`
3. The bot will convert it to a sticker!

### Using Commands
- `-help` - Show all commands
- `-roast` - Get roasted
- `-joke` - Hear a joke
- `-ask [question]` - Ask anything
- `-voice [text]` - Create voice message
- `-sticker` - Create sticker from media or text

### Check Bot Status
- `-ping` - Quick response check
- `-status` - Detailed bot statistics

## 🔧 Development

### Project Structure
```
eden-bot/
├── index.js              # Main bot file
├── commands/             # Command modules
│   ├── index.js         # Command registry
│   ├── help.js          # Help command
│   ├── sticker.js       # Sticker creator
│   ├── roast.js         # Roast generator
│   ├── ping.js          # Ping command
│   ├── info.js          # Info command
│   ├── joke.js          # Joke generator
│   └── quote.js         # Quote generator
├── package.json         # Dependencies
└── README.md           # This file
```

### Adding New Commands

1. Create a new file in the `commands/` directory (e.g., `mycommand.js`)
2. Use this template:

```javascript
module.exports = {
    name: 'mycommand',
    description: 'Description of your command',
    usage: '.mycommand [args]',
    
    async execute(client, message, args) {
        // Your command logic here
        await message.reply('Command response');
    }
};
```

3. Register it in `commands/index.js`:

```javascript
const mycommand = require('./mycommand');

module.exports = {
    // ... other commands
    mycommand
};
```

## 📦 Dependencies

- **whatsapp-web.js** - WhatsApp Web API wrapper
- **qrcode-terminal** - QR code generation for terminal
- **axios** - HTTP client (for future API integrations)

## ⚙️ Configuration

The bot uses LocalAuth strategy which saves your session locally. Authentication data is stored in:
- `.wwebjs_auth/` - Session data
- `.wwebjs_cache/` - Cache files

These folders are git-ignored for security.

## 🚀 Deployment Tips

### Running with PM2 (recommended for production)
```bash
npm install -g pm2
pm2 start index.js --name eden-bot
pm2 save
pm2 startup
```

### Running in Development Mode
```bash
npm run dev
```

## ⚠️ Important Notes

- First run will require QR code scanning
- Keep your session secure (don't share `.wwebjs_auth/`)
- The bot needs to stay running to respond to messages
- Large media files may take longer to process for stickers
- WhatsApp may rate-limit if you send too many messages too quickly

## 🐛 Troubleshooting

**QR Code not appearing?**
- Make sure you have a stable internet connection
- Try deleting `.wwebjs_auth/` and `.wwebjs_cache/` folders and restart

**Bot not responding?**
- Check if the bot is still running
- Verify your internet connection
- Check terminal logs for errors

**Sticker creation failing?**
- Ensure the media file isn't too large (< 1MB recommended)
- Supported formats: JPEG, PNG, WebP, MP4, GIF

## 📄 License

ISC

## 💖 Contributing

Feel free to fork this project and submit pull requests with new features or improvements!

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Made with ❤️ using whatsapp-web.js
