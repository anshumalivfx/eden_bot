# 🍓 Raspberry Pi Chromium Error Fix

## The Error

```
Error: Failed to launch the browser process!
spawn /home/pi/eden_bot/node_modules/puppeteer-core/.local-chromium/linux-1045629/chrome-linux/chrome ENOENT
```

This means Puppeteer can't find or run the bundled Chromium browser on your Raspberry Pi.

## Quick Fix (Automated)

Run this script to automatically install everything:

```bash
chmod +x fix-rpi-chromium.sh
sudo ./fix-rpi-chromium.sh
```

This will:
- ✅ Install system Chromium browser
- ✅ Install all required dependencies
- ✅ Install ffmpeg (for music downloads)
- ✅ Install yt-dlp (for YouTube downloads)
- ✅ Increase swap space (recommended)
- ✅ Configure everything automatically

## Manual Fix (Step by Step)

If you prefer to do it manually:

### 1. Install Chromium Browser

```bash
sudo apt-get update
sudo apt-get install -y chromium-browser
```

### 2. Install Required Dependencies

```bash
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6
```

### 3. Install ffmpeg and yt-dlp (for music feature)

```bash
# Install ffmpeg
sudo apt-get install -y ffmpeg

# Install yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### 4. Increase Swap Space (Recommended)

WhatsApp Web needs memory. Increase swap to at least 1GB:

```bash
# Stop swap
sudo dphys-swapfile swapoff

# Edit config (change to 1024)
sudo nano /etc/dphys-swapfile
# Find: CONF_SWAPSIZE=100
# Change to: CONF_SWAPSIZE=1024

# Or use sed
sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile

# Recreate and start swap
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Verify
free -m
```

### 5. Restart Your Bot

```bash
cd /home/pi/eden_bot
npm start
```

## Why This Happens

1. **Bundled Chromium doesn't work** - Puppeteer's bundled Chromium isn't compatible with ARM architecture
2. **Missing dependencies** - Raspberry Pi doesn't have all libraries by default
3. **Low memory** - WhatsApp Web needs more memory than default swap provides

## The Fix Explained

The bot now:
1. ✅ **Detects Raspberry Pi** automatically
2. ✅ **Uses system Chromium** instead of bundled version
3. ✅ **Applies optimizations** for better stability
4. ✅ **Shows helpful errors** if Chromium isn't found

## Verify Chromium Installation

```bash
# Check if Chromium is installed
which chromium-browser
# Should show: /usr/bin/chromium-browser

# Check version
chromium-browser --version
# Should show: Chromium 120.x.x.x Built on Raspbian
```

## Bot Will Now Auto-Detect

When you run the bot, you'll see:

```
🍓 Raspberry Pi detected! Looking for system Chromium...
✅ Found Chromium at: /usr/bin/chromium-browser
🍓 Applying Raspberry Pi optimizations...
🚀 Starting Eden Bot...
```

## Performance Tips

### 1. Use the Optimized Startup Script

```bash
./start-rpi.sh
```

This script sets optimal Node.js memory limits for Raspberry Pi.

### 2. Close Other Applications

WhatsApp Web needs resources. Close:
- Browsers
- Heavy applications
- Unnecessary services

### 3. Be Patient

First connection takes **1-3 minutes** on Raspberry Pi. This is normal!

```
⏳ Connecting... (this takes 1-3 minutes on Raspberry Pi)
⏳ Still connecting... Please be patient...
```

### 4. Monitor Memory

```bash
# Check memory usage
free -h

# Check swap usage
swapon --show
```

## Troubleshooting

### Still Getting Error?

1. **Verify Chromium is installed:**
   ```bash
   chromium-browser --version
   ```

2. **Check for errors:**
   ```bash
   npm start 2>&1 | tee error.log
   ```

3. **Try manual path:**
   Edit `.env` and add:
   ```
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
   ```

### Chromium Crashes?

Increase memory allocation:

```bash
# Edit cmdline.txt
sudo nano /boot/cmdline.txt

# Add to the end (same line):
cma=256M

# Reboot
sudo reboot
```

### Very Slow?

1. **Close desktop environment** if running headless:
   ```bash
   sudo systemctl set-default multi-user.target
   sudo reboot
   ```

2. **Disable unnecessary services:**
   ```bash
   sudo systemctl disable bluetooth
   sudo systemctl disable hciuart
   ```

3. **Overclock** (Raspberry Pi 4 only):
   ```bash
   sudo nano /boot/config.txt
   # Add:
   over_voltage=6
   arm_freq=2000
   ```

## Expected Behavior

### Normal Raspberry Pi Startup:

```
🍓 Raspberry Pi detected! Looking for system Chromium...
✅ Found Chromium at: /usr/bin/chromium-browser
🍓 Applying Raspberry Pi optimizations...
🚀 Starting Eden Bot...
😈 Ready to be sarcastic and respond to mentions!
📝 Commands start with "-"
🔔 Will respond when mentioned or replied to

⏳ Connecting to WhatsApp...
⏳ This usually takes 1-3 minutes on Raspberry Pi, please be patient...

🔐 QR Code received! Scan it with WhatsApp:
[QR CODE DISPLAYED]

⏰ QR code expires in 60 seconds. Scan it now!
✅ Authentication successful!
🔐 Session saved - you won't need to scan QR next time
⏳ Connecting to WhatsApp...
⏳ Still connecting... Please wait, WhatsApp Web is initializing...

✅ Eden Bot is ready and connected!
📱 Listening for commands and mentions...
```

### First Time: 2-3 minutes
### Subsequent Starts: 1-2 minutes

## Supported Raspberry Pi Models

- ✅ Raspberry Pi 4 (4GB/8GB recommended)
- ✅ Raspberry Pi 3B+
- ⚠️ Raspberry Pi 3B (slower, need swap)
- ⚠️ Raspberry Pi Zero 2 W (very slow)
- ❌ Raspberry Pi Zero/Zero W (too slow)

## Recommended Setup

**Best Performance:**
- Raspberry Pi 4 (4GB or 8GB RAM)
- Class 10 SD card or SSD
- Ethernet connection (not WiFi)
- 1024MB+ swap space
- Headless mode (no desktop)

## Summary

**The issue:** Bundled Chromium doesn't work on ARM architecture

**The solution:** Use system Chromium browser

**The fix:** 
```bash
sudo apt-get install chromium-browser
npm start
```

**That's it!** The bot will auto-detect and use the system Chromium.

---

**Need help?** Check the logs and make sure:
1. ✅ Chromium is installed
2. ✅ Dependencies are installed  
3. ✅ Swap is at least 512MB
4. ✅ You're being patient (1-3 minutes)

🍓 **Your Raspberry Pi can now run Eden Bot!**
