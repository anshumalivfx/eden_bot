# 🔮 Google Gemini 2.0 Flash - FREE Image Generation Setup

## ✅ What You Get (100% FREE):
- **Text-to-Image generation** with Gemini 2.0 Flash
- **1024x1024 resolution** images
- **High quality** from Google's latest model
- **Generous free tier** rate limits
- **No credit card required**

---

## 📍 Step 1: Get Your FREE API Key

1. **Go to Google AI Studio:**
   ```
   https://aistudio.google.com/apikey
   ```

2. **Sign in with your Google account** (any Gmail works)

3. **Click "Create API Key"**
   - Choose "Create API key in new project" (easiest)
   - Or select existing Google Cloud project

4. **Copy your API key** (looks like: `AIzaSyC...`)

---

## 📝 Step 2: Add API Key to Eden

1. **Open `.env` file** in your Eden bot folder

2. **Find this line:**
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Replace with your actual key:**
   ```bash
   GEMINI_API_KEY=AIzaSyC1234567890abcdefghijklmnop
   ```

4. **Save the file**

---

## 🎨 Step 3: Use Gemini Image Generation

### **Default (Pollinations - Unlimited):**
```
-imagine a beautiful sunset over mountains
```

### **Use Gemini explicitly:**
```
-imagine [provider:gemini] a cyberpunk city at night
```

### **Gemini with specific prompt:**
```
-imagine [provider:gemini] photorealistic portrait of a cat wearing sunglasses
```

---

## 🔄 How It Works

### **Two Providers Available:**

1. **Pollinations AI** (Default):
   - ✅ 100% FREE
   - ✅ Unlimited usage
   - ✅ No API key needed
   - ✅ Multiple models (flux, turbo, anime, etc.)
   - ⚡ Fast and reliable

2. **Google Gemini 2.0 Flash** (Backup):
   - ✅ 100% FREE (with API key)
   - ✅ High quality Google AI
   - ✅ 1024x1024 resolution
   - ⚠️ Rate limited (generous free tier)
   - 🔑 Requires free API key

### **Automatic Fallback:**
If Gemini fails (rate limit, API error), Eden automatically switches to Pollinations!

---

## 📊 Free Tier Limits (Gemini)

| Feature | Free Tier |
|---------|-----------|
| Requests per minute | 15 RPM |
| Requests per day | 1,500 RPD |
| Tokens per minute | 1M TPM |
| Cost | **$0 (FREE)** |

**Note:** These limits are PER API KEY. You can create multiple keys if needed.

---

## 🎯 Usage Examples

### **Basic image generation:**
```
-imagine a majestic dragon flying over mountains
```
*(Uses Pollinations by default)*

### **Use Gemini for higher quality:**
```
-imagine [provider:gemini] hyperrealistic portrait of Albert Einstein
```

### **Combine with models (Pollinations only):**
```
-imagine [model:turbo] quick sketch of a robot
-imagine [model:flux-anime] anime girl with blue hair
```

### **Image transformation:**
```
(Reply to an image)
-transform make it look like an oil painting
```

---

## 🔧 Troubleshooting

### **"Gemini API key not configured"**
- Check `.env` file has the correct key
- Make sure you replaced `your_gemini_api_key_here`
- Restart the bot after updating `.env`

### **"Invalid Gemini API key"**
- Get a new key from https://aistudio.google.com/apikey
- Make sure you copied the entire key
- Check for extra spaces in `.env`

### **"Gemini rate limit reached"**
- You've hit the free tier limit (15 per minute or 1,500 per day)
- Wait a few minutes and try again
- Or use Pollinations: `-imagine your prompt` (no limits!)

### **"Gemini failed, using Pollinations instead"**
- Automatic fallback activated
- Image will still be generated using Pollinations
- No action needed!

---

## 🆚 Pollinations vs Gemini

| Feature | Pollinations | Gemini 2.0 Flash |
|---------|--------------|------------------|
| **Cost** | 100% FREE | 100% FREE |
| **API Key** | ❌ Not needed | ✅ Required (free) |
| **Rate Limits** | ✅ None | ⚠️ 1,500/day |
| **Quality** | High | Very High |
| **Speed** | Fast | Fast |
| **Models** | 5 models | 1 model |
| **Resolution** | 1024x1024 | 1024x1024 |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Recommendation:** Use Pollinations as default (unlimited), Gemini when you need extra quality!

---

## 🎉 You're All Set!

Eden now has **TWO FREE image generation APIs**:
- **Primary:** Pollinations (unlimited, no setup)
- **Backup:** Gemini (high quality, requires free key)

Start generating images:
```
-imagine a futuristic city with flying cars
```

Enjoy! 🚀

---

## 📚 Additional Resources

- **Gemini API Documentation:** https://ai.google.dev/gemini-api/docs
- **Get API Key:** https://aistudio.google.com/apikey
- **Pricing Info:** https://ai.google.dev/gemini-api/docs/pricing
- **Rate Limits:** https://ai.google.dev/gemini-api/docs/rate-limits
- **Pollinations AI:** https://pollinations.ai/

---

**Pro Tip:** Keep your Gemini API key secret! Don't share it or commit it to Git.
