# Async Labs Dubbing Integration

Voice message dubbing with **Async Labs Voice API** featuring instant voice cloning.

## 🌟 Features

### Async Labs TTS
- ✅ **Voice Cloning** - Preserves original speaker's voice (5+ second sample)
- ✅ **Fast Processing** - ~300ms latency for real-time performance
- ✅ **High Quality** - Natural-sounding speech synthesis
- ✅ **Multi-language** - Supports 28+ languages
- ⚠️ **Paid Service** - Requires API subscription

## 🔧 Setup

### 1. Get Async Labs API Key

1. Sign up at [https://app.async.ai/](https://app.async.ai/)
2. Navigate to **API Keys** → **Create API Key**
3. Copy your API key (starts with `sk_`)
4. Add to `.env` file:

```bash
# Voice Dubbing Configuration
DUB_TTS_ENGINE=asynclabs
ASYNCLABS_API_KEY=sk_your_api_key_here

# For transcription (asynclabs requires manual transcription)
DUB_TRANSCRIPTION_ENGINE=whisper-local  # or "groq"
```

### 2. Verify Configuration

Check that your service is configured:

```bash
# Should show "TTS Engine: ASYNCLABS"
node -e "require('./services/dubService')"
```

## 📝 Usage

### Basic Dubbing

In WhatsApp, reply to any voice message with:

```
-dub spanish
```

### All Supported Languages

```
-dub hindi       # Hindi
-dub spanish     # Spanish
-dub french      # French
-dub german      # German
-dub italian     # Italian
-dub portuguese  # Portuguese
-dub russian     # Russian
-dub japanese    # Japanese
-dub korean      # Korean
-dub chinese     # Chinese (Mandarin)
-dub arabic      # Arabic
-dub turkish     # Turkish
-dub polish      # Polish
-dub dutch       # Dutch
```

**Example:**
```
User: [Sends voice message in English]
You: -dub french
Bot: [Returns dubbed voice in French with YOUR voice]
```

## 🔄 How It Works

### Async Labs Workflow

1. **Transcribe** - Whisper/Groq converts voice → text (detects language)
2. **Translate** - Google Translate converts text to target language
3. **Clone Voice** - Async Labs creates instant voice clone from audio sample
4. **Synthesize** - Async Labs generates speech with cloned voice
5. **Return** - Dubbed voice message sent back

### Processing Steps

```
Voice Message (Ogg/Opus)
    ↓
Convert to MP3 (for compatibility)
    ↓
Transcribe with Whisper/Groq
    ↓
Translate to target language
    ↓
Create instant voice clone
    ↓
Generate speech with cloned voice
    ↓
Convert PCM to OGG (WhatsApp format)
    ↓
Send dubbed message
```

## 🆚 Comparison with Other Engines

| Feature | Piper | ElevenLabs | Async Labs |
|---------|-------|------------|------------|
| Cost | Free | Paid | Paid |
| Voice Cloning | ❌ No | ✅ Yes | ✅ Yes (Instant) |
| Speed | Medium | Slow | Fast (~300ms) |
| Voice Quality | Good | Excellent | Excellent |
| Setup | Easy | Easy | Easy |
| Raspberry Pi | ✅ Yes | ✅ Yes | ✅ Yes |
| API Limits | None | Moderate | Per plan |
| Real-time | No | No | ✅ Yes |

## 📊 API Features

### Instant Voice Clone
- Creates voice clone from 5+ seconds of audio
- No training required
- Works with any language
- High-quality voice replication

### Text-to-Speech Options
- **Streaming**: Real-time audio generation
- **Standard**: Full audio file generation
- **With Timestamps**: Word-level timing data
- **WebSocket**: Incremental text processing

### Output Formats Supported
- PCM (raw)
- WAV
- MP3
- OGG (Opus) - used for WhatsApp

## 🔍 Troubleshooting

### "Invalid Async Labs API key"
```bash
# Check your API key in .env
DUB_TTS_ENGINE=asynclabs
ASYNCLABS_API_KEY=sk_your_actual_key_here
```

### "Async Labs rate limit exceeded"
- You've hit your API plan limit
- Upgrade your plan at [https://app.async.ai/](https://app.async.ai/)
- Or switch to `piper` (free) temporarily

### Voice cloning quality issues
- Ensure audio sample is at least 5 seconds long
- Use clear audio without background noise
- Verify transcription is accurate first

### FFmpeg conversion errors
```bash
# Install/update ffmpeg
sudo apt install ffmpeg  # Linux
brew install ffmpeg      # macOS
```

## 💡 Tips

1. **Best Results**:
   - Use clear audio with minimal background noise
   - Longer samples (10+ seconds) produce better clones
   - Ensure transcription is accurate before dubbing

2. **Cost Optimization**:
   - Start with `piper` for testing (free)
   - Switch to `asynclabs` when voice cloning is needed
   - Monitor API usage in Async dashboard

3. **Performance**:
   - Async Labs is fastest for real-time applications
   - Local Whisper works best for long audio
   - Groq Whisper is fastest for short clips (<10 min)

## 📚 API Documentation

- **Official Docs**: [https://docs.async.ai/](https://docs.async.ai/)
- **Getting Started**: [https://docs.async.ai/getting-started-with-the-async-voice-api-990331m0](https://docs.async.ai/getting-started-with-the-async-voice-api-990331m0)
- **Dashboard**: [https://app.async.ai/](https://app.async.ai/)

## 🎯 Next Steps

- [ ] Test with different voice samples
- [ ] Monitor API usage and costs
- [ ] Experiment with different languages
- [ ] Compare quality with ElevenLabs

---

Enjoy high-quality voice dubbing with Async Labs! 🎉
