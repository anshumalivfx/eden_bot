# 🍓 Raspberry Pi Navigation Error Fix

## Problem
```
Error: Execution context was destroyed, most likely because of a navigation.
```

This error occurs on Raspberry Pi because WhatsApp Web is navigating/reloading faster than the Pi can handle, causing the execution context to be destroyed.

## What Was Fixed

### 1. **Added Critical Stability Flags**
```javascript
'--single-process'  // Run everything in single process (critical for Pi)
'--disable-plugins' // Disable unnecessary plugins
```

### 2. **Added Timeout Settings**
```javascript
timeout: 60000          // 60 seconds for page operations
protocolTimeout: 180000 // 3 minutes for protocol operations  
slowMo: 250             // Slow down all operations by 250ms
```

### 3. **Added WhatsApp Web.js Stability Settings**
```javascript
qrMaxRetries: 10           // More retries for QR
takeoverOnConflict: true   // Take over if session conflicts
takeoverTimeoutMs: 60000   // 60 second timeout for takeover
qrTimeoutMs: 120000        // 2 minutes for QR scan
authTimeoutMs: 120000      // 2 minutes for authentication
restartOnAuthFail: true    // Auto-restart on auth failure
```

### 4. **Added Retry Logic**
- Bot will retry initialization up to 3 times on Pi
- 5 second delay between retries
- Better error messages with troubleshooting tips

### 5. **Added Loading Screen Monitor**
- Shows loading percentage on Pi
- Helps debug where initialization fails

## Testing the Fix

1. **On your Raspberry Pi, pull the latest changes:**
```bash
cd ~/eden_bot
git pull  # If using git
# Or copy the updated index.js file
```

2. **Make sure dependencies are installed:**
```bash
sudo ./fix-rpi-chromium.sh
```

3. **Clear old session (if issues persist):**
```bash
rm -rf .wwebjs_auth
rm -rf .wwebjs_cache
```

4. **Start the bot:**
```bash
npm start
```

5. **What you should see:**
```
🍓 Raspberry Pi detected! Looking for system Chromium...
✅ Found Chromium at: /usr/bin/chromium
🍓 Applying Raspberry Pi optimizations...
🚀 Starting Eden Bot...
⚠️  Raspberry Pi detected: Initialization may take 1-2 minutes...
💡 Be patient - the Pi needs extra time to load WhatsApp Web

⏳ Loading: 0% - Initializing...
⏳ Loading: 25% - Loading WhatsApp Web...
⏳ Loading: 50% - Authenticating...
⏳ Loading: 75% - Almost ready...
⏳ Loading: 100% - Ready!
✅ Eden Bot is ready!
```

## If It Still Fails

### Quick Fixes

**1. Increase RAM Priority**
```bash
sudo sysctl vm.swappiness=10
sudo systemctl stop apt-daily.service
sudo systemctl stop unattended-upgrades.service
```

**2. Free Up Memory**
```bash
# Check memory
free -h

# Kill unnecessary processes
sudo killall chromium
pkill -f "node.*eden"

# Clear cache
sudo sync
sudo sysctl vm.drop_caches=3
```

**3. Disable Desktop Environment (if running headless)**
```bash
sudo systemctl set-default multi-user.target
sudo reboot
```

**4. Use Lighter Alternative (if all else fails)**
```bash
# Instead of running bot 24/7, run on-demand
# Create a systemd service that restarts on failure
# See RASPBERRY_PI_CHROMIUM_FIX.md for systemd setup
```

### Memory Requirements

| Pi Model | Min RAM | Recommended | Notes |
|----------|---------|-------------|-------|
| Pi 3 | 512MB free | 1GB free | Might struggle |
| Pi 4 (2GB) | 1GB free | 1.5GB free | Should work |
| Pi 4 (4GB+) | 1GB free | 2GB free | Best experience |
| Pi 5 | 1GB free | 2GB free | Excellent |

### Check If It's Working

**Monitor memory during startup:**
```bash
watch -n 1 free -h
```

**Check Chromium process:**
```bash
ps aux | grep chromium
```

**View bot logs with timestamps:**
```bash
npm start 2>&1 | ts '[%Y-%m-%d %H:%M:%S]'
```

## Understanding the Error

The "Execution context destroyed" error happens when:

1. **WhatsApp Web navigates** (changes page/reloads)
2. **Your code tries to execute** JavaScript on the old page
3. **But the page is gone**, so context is destroyed

On Raspberry Pi, this is worse because:
- Slower CPU = longer page load times
- Lower RAM = more swapping/delays
- WhatsApp Web doesn't wait for slow devices

## The Fix Strategy

Our fix addresses this by:

1. **Slowing everything down** (`slowMo: 250`)
2. **Giving more time** (60s timeout instead of 30s)
3. **Running single-process** (less context switching)
4. **Retrying on failure** (3 attempts with delays)
5. **Monitoring progress** (loading screen events)

## Performance Tips

**1. Run headless only** (no X server)
```bash
# Make sure these are in your config (they are now)
headless: true
'--disable-gpu'
'--no-sandbox'
```

**2. Overclock (if stable)**
```bash
# Edit /boot/config.txt
sudo nano /boot/config.txt

# Add (for Pi 4):
over_voltage=6
arm_freq=2000

# Save and reboot
sudo reboot
```

**3. Use faster SD card**
- Class 10 or better
- A2 rating recommended
- Or use USB 3.0 SSD boot

**4. Monitor temperature**
```bash
vcgencmd measure_temp
```
Keep it under 80°C (add heatsink/fan if needed)

## Alternative: Run on Desktop and Control Pi Remotely

If your Pi keeps struggling, consider:

1. **Run bot on desktop/laptop**
2. **Keep Pi as music player only** (mpg123 for YouTube audio)
3. **Use SSH to control Pi** from bot

This way the heavy WhatsApp Web.js runs on powerful machine, and Pi just plays audio.

## Success Indicators

You'll know it's working when:
- ✅ No more "Execution context destroyed" errors
- ✅ Bot starts within 1-2 minutes
- ✅ QR code appears and is scannable
- ✅ "Client is ready!" message appears
- ✅ Bot responds to test messages

## Still Having Issues?

**Check these files:**
- `RASPBERRY_PI_CHROMIUM_FIX.md` - Initial setup
- `RASPBERRY_PI_SETUP.md` - Hardware optimization
- GitHub Issues - Search for "raspberry pi navigation"

**System Info for Debugging:**
```bash
# Post this info when asking for help
echo "=== System Info ==="
uname -a
node --version
npm --version
free -h
df -h
/usr/bin/chromium --version
cat /proc/cpuinfo | grep Model
```

---

**Made with 🍓 for Raspberry Pi users**

*The navigation error is now handled with retries, timeouts, and proper Pi optimizations!*
