# 🆓 Free LLM Setup Guide for Eden

Eden supports multiple **FREE** LLM providers! Here's how to set them up:

## 🥇 Recommended: Groq (Fast & Free)

**Best option for most users - completely free with good performance!**

1. Go to [Groq Console](https://console.groq.com/)
2. Sign up with your email (free account)
3. Go to API Keys section
4. Create a new API key
5. Copy the key and add to `.env`:
   ```env
   GROQ_API_KEY=gsk_your_key_here
   ```

**Models available:** Llama 3, Mixtral, Gemma (all free!)

---

## 🤗 Hugging Face (Free with rate limits)

1. Go to [Hugging Face](https://huggingface.co/)
2. Sign up for free account
3. Go to Settings → Access Tokens
4. Create a new token
5. Add to `.env`:
   ```env
   HUGGINGFACE_API_KEY=hf_your_token_here
   ```

**Free tier:** 1000 requests/month

---

## 🧠 Cohere (Free tier available)

1. Go to [Cohere](https://cohere.ai/)
2. Sign up for free account
3. Go to API Keys section
4. Copy your API key
5. Add to `.env`:
   ```env
   COHERE_API_KEY=your_cohere_key_here
   ```

**Free tier:** Good for experimentation

---

## 🏠 Ollama (100% Free, runs locally)

**No internet required after setup, completely private!**

### macOS Setup:
```bash
brew install ollama
ollama pull llama2
ollama serve
```

### Linux Setup:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama2
ollama serve
```

### Windows Setup:
1. Download from [Ollama.ai](https://ollama.ai/)
2. Install and run
3. Open terminal: `ollama pull llama2`

**Advantages:**
- ✅ Completely free
- ✅ Works offline
- ✅ Privacy (no data sent to external servers)
- ✅ No API limits

**Models to try:**
- `ollama pull llama2` (good balance)
- `ollama pull mistral` (faster)
- `ollama pull codellama` (good for code questions)

---

## 🚀 Quick Start

1. **Choose one FREE option above**
2. **Add API key to `.env` file**
3. **Start Eden:**
   ```bash
   npm start
   ```
4. **Scan QR code with WhatsApp**
5. **Test:** Send `-help` in any chat

## 💡 Pro Tips

### Multiple Providers (Fallback)
You can set up multiple providers! Eden will try them in this order:
1. Groq (if configured)
2. Hugging Face (if configured) 
3. Cohere (if configured)
4. OpenAI (if you want paid option)
5. Ollama (local fallback)

### Best Free Combination:
```env
GROQ_API_KEY=your_groq_key
OLLAMA_URL=http://localhost:11434
```

This gives you:
- **Groq** for fast, high-quality responses
- **Ollama** as local backup when offline

## 🆓 Cost Comparison

| Provider | Cost | Quality | Speed | Setup |
|----------|------|---------|-------|-------|
| **Groq** | 🆓 Free | ⭐⭐⭐⭐ | ⚡⚡⚡ | Easy |
| **Ollama** | 🆓 Free | ⭐⭐⭐ | ⚡⚡ | Medium |
| **Hugging Face** | 🆓 Free* | ⭐⭐⭐ | ⚡ | Easy |
| **Cohere** | 🆓 Free* | ⭐⭐⭐ | ⚡⚡ | Easy |
| OpenAI | 💰 Paid | ⭐⭐⭐⭐⭐ | ⚡⚡⚡ | Easy |

*Free tier with limits

## 🎯 Recommendation

**For beginners:** Start with **Groq** - it's the easiest free option with great quality!

**For privacy enthusiasts:** Use **Ollama** - everything runs on your computer!

**For developers:** Use **both Groq + Ollama** for best of both worlds!
