# 🎤 On-Device Whisper Transcription Setup

## 🎯 Problem Solved:
- ✅ **Long audio files** (18-30 minutes) - no API limits
- ✅ **100% Free** - no Groq API costs
- ✅ **Privacy** - all processing happens on your device
- ✅ **Offline** - works without internet (after model download)
- ✅ **Unlimited** - transcribe as much as you want

---

## 📦 Installation

### **Step 1: Install OpenAI Whisper**

```bash
pip3 install openai-whisper
```

**This will also install required dependencies:**
- `torch` - PyTorch for ML
- `numpy` - Array processing
- `ffmpeg-python` - Audio processing

### **Step 2: Verify Installation**

```bash
python3 -c "import whisper; print('Whisper installed successfully!')"
```

You should see: `Whisper installed successfully!`

---

## 🔧 Configuration

### **Option 1: Use Local Whisper (Recommended for Long Audio)**

**Edit `.env` file:**
```bash
DUB_TRANSCRIPTION_ENGINE=whisper-local
```

- ✅ Unlimited audio length
- ✅ No API costs
- ✅ Better privacy
- ⏱️ Slower (1-3 minutes for 30-min audio)

### **Option 2: Use Groq Whisper (Fast for Short Audio)**

**Edit `.env` file:**
```bash
DUB_TRANSCRIPTION_ENGINE=groq
```

- ⚡ Very fast (seconds)
- ✅ Good for short audio (<10 minutes)
- ⚠️ API limits apply
- ☁️ Requires internet

### **Smart Auto-Selection (Default)**

If you set `DUB_TRANSCRIPTION_ENGINE=whisper-local`, Eden will:
- Use **local Whisper** for files > 10 minutes
- Automatically fallback to **local Whisper** if Groq fails
- Check audio duration before choosing

---

## 🎯 How It Works

```
User sends voice note → Eden checks duration
                              ↓
                    Is it > 10 minutes?
                              ↓
              YES → Local Whisper (unlimited)
               NO → Groq (fast) with fallback to Whisper
```

---

## 🚀 Usage

### **Test with -dub command:**

```
-dub hindi (reply to voice note)
```

**What happens:**
1. 📊 Eden checks audio duration
2. 🎤 Transcribes using best engine:
   - **Groq**: <10 min audio (fast, cloud)
   - **Whisper**: >10 min audio (slower, local)
3. 🌐 Translates to target language
4. 🗣️ Generates dubbed audio
5. 📤 Sends back dubbed version

---

## 📊 Performance Comparison

| Feature | Groq Whisper | Local Whisper |
|---------|--------------|---------------|
| **Speed (5 min audio)** | ~10 seconds | ~30 seconds |
| **Speed (30 min audio)** | ❌ Fails | ~3 minutes |
| **Max Length** | ~10 minutes | ♾️ Unlimited |
| **Cost** | Free (limited) | 100% Free |
| **Privacy** | Cloud | Local only |
| **Offline** | ❌ No | ✅ Yes* |
| **Quality** | Excellent | Excellent |

*After models are downloaded

---

## 🔍 Whisper Models

Eden uses **`base`** model by default (best balance):

| Model | Size | Speed | Accuracy | RAM Usage |
|-------|------|-------|----------|-----------|
| `tiny` | 75 MB | Very Fast | Good | ~1 GB |
| **`base`** | 142 MB | Fast | Very Good | ~1.5 GB |
| `small` | 466 MB | Medium | Excellent | ~2.5 GB |
| `medium` | 1.5 GB | Slow | Excellent | ~5 GB |
| `large` | 3 GB | Very Slow | Best | ~10 GB |

### **To use different model:**

Edit `dubService.js` line where it says:
```javascript
model = whisper.load_model('base')
```

Change `'base'` to `'tiny'`, `'small'`, etc.

---

## 🐛 Troubleshooting

### **"No module named 'whisper'"**

**Solution:**
```bash
pip3 install openai-whisper
```

### **"Failed to load audio file"**

**Solution:**
ffmpeg might be missing:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg
```

### **Transcription is slow**

**Solutions:**
1. Use `tiny` or `base` model (faster)
2. Use Groq for short audio (<10 min)
3. Upgrade RAM if using large models

### **"CUDA not available" warning**

This is normal on Mac/CPU-only systems. Whisper will use CPU (slower but works fine).

### **Python version issues**

Make sure you have Python 3.8+:
```bash
python3 --version
```

Should show 3.8 or higher.

---

## ⚙️ Advanced Configuration

### **Force Groq for all audio:**

```bash
DUB_TRANSCRIPTION_ENGINE=groq
```

But this will fail on long audio (>10 min).

### **Always use local Whisper:**

```bash
DUB_TRANSCRIPTION_ENGINE=whisper-local
```

Best for privacy and unlimited length.

### **Change Whisper model quality:**

Edit `services/dubService.js`:
```javascript
// Line ~248
model = whisper.load_model('small')  // Change to tiny/base/small/medium/large
```

---

## 💡 Tips

1. **For daily use:** Keep `whisper-local` (default)
2. **For quick tests:** Use `groq` for short audio
3. **Low RAM?** Use `tiny` model
4. **Best quality?** Use `small` or `medium` model
5. **30-min audio?** Always use local Whisper

---

## 📝 Examples

### **30-minute podcast dubbing:**
```
User: (sends 30-min voice note)
User: -dub spanish

Eden: 📊 Audio duration: 30m 15s
Eden: 🖥️ Using on-device Whisper (unlimited, no API limits)
Eden: 🎤 Transcribing with local Whisper (this may take a few minutes...)
(3 minutes later)
Eden: ✅ Transcribed: "Welcome to our podcast..." (en)
Eden: 🌐 Translating to spanish...
Eden: 🗣️ Generating dubbed audio with Piper TTS...
Eden: (sends dubbed Spanish audio)
```

### **Short 3-minute voice note:**
```
User: (sends 3-min voice note)
User: -dub hindi

Eden: 📊 Audio duration: 3m 12s
Eden: ☁️ Using Groq Whisper (cloud, fast)
Eden: ✅ Transcribed in 8 seconds
Eden: (sends dubbed Hindi audio)
```

---

## 🎉 You're All Set!

Eden now supports:
- ✅ **On-device transcription** for long audio
- ✅ **Cloud transcription** for fast processing
- ✅ **Smart auto-selection** based on duration
- ✅ **Automatic fallback** if cloud fails

Test it with:
```
-dub french (reply to any voice note)
```

---

## 🔗 Resources

- **Whisper GitHub:** https://github.com/openai/whisper
- **Whisper Models:** https://github.com/openai/whisper#available-models-and-languages
- **PyTorch:** https://pytorch.org/
- **ffmpeg:** https://ffmpeg.org/

---

**Note:** First time running Whisper will download the model (~142 MB for base). This happens automatically and only once.
