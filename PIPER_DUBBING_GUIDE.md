# Voice Dubbing Feature - Piper TTS Setup

Voice message dubbing with automatic translation using **free & open-source** tools:
- 🎤 **Groq Whisper** - Speech-to-Text (free)
- 🌐 **Google Translate** - Translation (free)
- 🗣️ **Piper TTS** - Text-to-Speech (open source, runs locally)

## Features

- ✅ **Completely Free** - No paid API subscriptions
- ✅ **Works on Raspberry Pi** - Optimized for ARM devices
- ✅ **11 Languages** - English, Hindi, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Chinese, Arabic
- ✅ **Natural Voices** - High-quality neural TTS
- ⚠️ **No Voice Cloning** - Uses synthetic voices (original voice not preserved)

## Quick Setup

### 1. Download Piper Models

Run the setup script to download Piper binary and voice models (~500MB):

```bash
./setup-piper.sh
```

This script:
- Detects your system (Raspberry Pi, Mac, Linux)
- Downloads correct Piper binary
- Downloads voice models for 11 languages
- Makes everything executable

### 2. Set Environment Variables

Add to your `.env` file:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Get your free Groq API key: https://console.groq.com/keys

### 3. Test It!

```bash
npm start
```

In WhatsApp, reply to any voice message with:
```
-dub hi    # Dub to Hindi
-dub es    # Dub to Spanish
-dub fr    # Dub to French
```

## Usage

**Reply to a voice message with:**
```
-dub [language_code]
```

**Examples:**
- `-dub` → English (default)
- `-dub hi` → Hindi
- `-dub es` → Spanish
- `-dub fr` → French
- `-dub de` → German

**Supported Languages:**
- `en` - English
- `hi` - Hindi
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `ru` - Russian
- `ja` - Japanese
- `zh` - Chinese
- `ar` - Arabic

## Rate Limits

- **5 dubs per user per day** (free tier protection)
- Resets at midnight automatically
- Prevents API abuse

## How It Works

1. **Transcribe** - Groq Whisper converts voice → text (detects language)
2. **Translate** - Google Translate converts text → target language
3. **Synthesize** - Piper TTS converts text → speech (natural voice)
4. **Return** - Dubbed voice message sent back

## Performance

- **Raspberry Pi 4**: ~10-15 seconds per dub
- **Raspberry Pi 3**: ~20-30 seconds per dub
- **Mac/PC**: ~5-10 seconds per dub

## Troubleshooting

### "Piper model not found"
Run `./setup-piper.sh` to download models

### "Failed to generate speech"
- Check `piper/piper` exists and is executable: `chmod +x piper/piper`
- Check models exist in `piper-models/`
- For Raspberry Pi: Make sure you have ~1GB free space

### "Failed to transcribe"
- Check GROQ_API_KEY in `.env`
- Verify Groq quota: https://console.groq.com

### Slow performance on Raspberry Pi
- This is normal for Piper TTS on ARM devices
- Consider upgrading to Pi 4 or Pi 5 for better performance
- Close other applications to free RAM

## Files Structure

```
eden/
├── setup-piper.sh          # Setup script (run this first!)
├── piper/                  # Piper binary (auto-downloaded)
│   └── piper
├── piper-models/           # Voice models (auto-downloaded)
│   ├── en_US-lessac-medium.onnx
│   ├── hi_IN-ravidas-medium.onnx
│   └── ... (other languages)
├── services/
│   └── dubService.js       # Dubbing pipeline
├── database/
│   └── dubUsageStore.js    # Rate limiting
└── dub-usage.json          # Usage tracking (auto-created)
```

## Comparison: Piper vs ElevenLabs

| Feature | Piper TTS | ElevenLabs |
|---------|-----------|------------|
| Cost | Free | $5-22/month |
| Voice Quality | Good | Excellent |
| Voice Cloning | ❌ No | ✅ Yes |
| Speed (Pi 4) | 10-15s | 5-10s |
| Languages | 28 | 29 |
| Rate Limits | None | Free tier blocked |
| Internet Required | Yes (STT + translate) | Yes |

## Future Improvements

- [ ] Add more Piper voices per language
- [ ] Cache translations for repeated phrases
- [ ] Optimize for faster processing
- [ ] Add voice cloning with RVC (advanced)

## Credits

- **Piper TTS** - https://github.com/rhasspy/piper
- **Groq** - https://groq.com
- **Google Translate** - https://cloud.google.com/translate

---

Enjoy free voice dubbing! 🎉
