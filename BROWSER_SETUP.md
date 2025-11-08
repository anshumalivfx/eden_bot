# 🌐 Browser Configuration for Eden

Eden uses Puppeteer with WhatsApp Web, which requires a Chromium-based browser. The bot will automatically detect and use available browsers on your system.

## 🔍 Auto-Detection

Eden checks the following locations in order and uses the first one found:

### Linux
1. `/usr/bin/chromium` - Standard Chromium
2. `/usr/bin/chromium-browser` - Alternative Chromium
3. `/snap/bin/chromium` - Snap-installed Chromium
4. `/usr/bin/google-chrome` - Google Chrome
5. `/usr/bin/google-chrome-stable` - Chrome stable

### macOS
1. `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
2. `/Applications/Chromium.app/Contents/MacOS/Chromium`

### Fallback
If no browser is found, Eden uses **Puppeteer's bundled Chromium** (automatically installed with the package).

## 📦 Installing Browsers

### macOS
```bash
# Install Chromium via Homebrew
brew install chromium

# Or install Google Chrome
# Download from: https://www.google.com/chrome/
```

### Linux (Debian/Ubuntu)
```bash
# Install Chromium
sudo apt-get update
sudo apt-get install chromium-browser

# Or install Google Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
```

### Linux (Fedora/RHEL)
```bash
# Install Chromium
sudo dnf install chromium

# Or install Google Chrome
sudo dnf install google-chrome-stable
```

## 🧪 Test Browser Detection

Run the test script to see which browser Eden will use:

```bash
node test-browser.js
```

Example output:
```
🔍 Testing Browser Detection...

🔍 Checking browser locations:

1. ✅ Chromium: /usr/bin/chromium
2. ❌ Chromium: /usr/bin/chromium-browser
...

📋 Browser Configuration:
🎯 SELECTED: /usr/bin/chromium
✅ Eden will use this browser
```

## ⚙️ Custom Browser Path

If you have a browser installed at a non-standard location, you can add it to the detection list in `index.js`:

```javascript
const possiblePaths = [
  '/your/custom/path/to/chromium',  // Add your path here
  '/usr/bin/chromium',
  // ... other paths
];
```

## 🐛 Troubleshooting

### Issue: "Browser not found" or "Failed to launch browser"

**Solution 1**: Install Chromium or Chrome using the commands above

**Solution 2**: Let Puppeteer use its bundled Chromium (no installation needed)
- This is automatic if no browser is detected
- The bundled version works perfectly fine

### Issue: "Browser crashes" or "Connection timeout"

**Solution**: The bot already includes optimal flags for stability:
```javascript
args: [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--single-process",
  "--disable-gpu",
]
```

### Issue: Running on a server without display

**Solution**: The bot runs in **headless mode** by default (no GUI needed)
- Works perfectly on headless servers
- No X server or display required

## 💡 Recommended Setup

### For Development (Local Machine)
- **Use system-installed Chrome/Chromium** for better debugging
- Install via package manager (brew, apt, dnf)
- Easier to inspect with Chrome DevTools if needed

### For Production (Server)
- **Use Puppeteer's bundled Chromium** for simplicity
- No extra installation required
- Fully isolated and version-controlled

### For Docker/Containers
- Install Chromium in your Dockerfile:
```dockerfile
RUN apt-get update && apt-get install -y \
    chromium-browser \
    --no-install-recommends
```

## 📊 Browser Detection Log

When you start Eden, you'll see:
```
🌐 Using browser at: /usr/bin/chromium
```
or
```
🌐 Using Puppeteer default browser (bundled Chromium)
```

This confirms which browser is being used.

## ✅ Quick Start

**Option 1: Use bundled Chromium (easiest)**
```bash
npm install
npm start
# That's it! No browser installation needed
```

**Option 2: Use system Chromium (recommended)**
```bash
# macOS
brew install chromium

# Linux
sudo apt-get install chromium-browser

# Then start Eden
npm start
```

---

**Eden will work with either option! The bundled Chromium is perfectly fine for most use cases.** 🤖✨
