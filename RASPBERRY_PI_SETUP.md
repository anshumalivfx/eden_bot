# 🍓 Eden on Raspberry Pi - Complete Setup Guide

This guide helps you run Eden WhatsApp Bot on Raspberry Pi with optimal performance.

## 🚨 Common Raspberry Pi Issues Fixed

The error you encountered:
```
Protocol error (Network.setUserAgentOverride): Session closed
```

This happens due to:
- Limited RAM on Raspberry Pi
- Browser compatibility issues
- Insufficient swap space
- Puppeteer timeout issues

**✅ All of these are now fixed in the updated code!**

## 📋 Prerequisites

### Hardware Requirements
- **Raspberry Pi 3B+ or newer** (4GB RAM recommended)
- **MicroSD Card**: 16GB minimum (32GB recommended)
- **Stable Internet**: Ethernet preferred over WiFi
- **Power Supply**: Official 5V/3A adapter recommended

### Software Requirements
- **Raspberry Pi OS** (Bullseye or newer)
- **Node.js** 16+ and npm
- **Chromium Browser**

## 🛠️ Step-by-Step Setup

### 1. Update Your System

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### 2. Install Chromium Browser

```bash
# Install Chromium (required for WhatsApp Web)
sudo apt-get install -y chromium-browser

# Verify installation
chromium-browser --version
```

### 3. Increase Swap Space (Important!)

Raspberry Pi needs more swap for browser operations:

```bash
# Stop swap
sudo dphys-swapfile swapoff

# Edit swap config
sudo nano /etc/dphys-swapfile

# Change this line:
CONF_SWAPSIZE=1024
# (or 2048 for better performance)

# Save and exit (Ctrl+X, Y, Enter)

# Recreate swap
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Verify
free -h
```

### 4. Install Eden

```bash
# Clone the repository
cd ~
git clone https://github.com/yourusername/eden_bot.git
cd eden_bot

# Install dependencies
npm install

# Set up environment
cp .env.example .env
nano .env  # Add your configuration
```

### 5. Configure Eden for Raspberry Pi

The code now automatically detects Raspberry Pi and applies optimizations:
- ✅ Increased timeouts (2-3 minutes)
- ✅ Optimized browser flags
- ✅ Automatic retry logic
- ✅ Better error handling
- ✅ Memory-efficient settings

## 🚀 Running Eden

### Option 1: Use the Optimized Startup Script (Recommended)

```bash
./start-rpi.sh
```

This script automatically:
- Checks for Chromium installation
- Monitors memory usage
- Sets optimal Node.js memory limits
- Provides troubleshooting tips

### Option 2: Run Manually

```bash
# Set memory limit for Node.js
export NODE_OPTIONS="--max-old-space-size=512"

# Start Eden
node index.js
```

### Option 3: Run as System Service

Create a systemd service for auto-start:

```bash
# Create service file
sudo nano /etc/systemd/system/eden.service
```

Add this content:

```ini
[Unit]
Description=Eden WhatsApp Bot
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/eden_bot
Environment="NODE_OPTIONS=--max-old-space-size=512"
ExecStart=/usr/bin/node /home/pi/eden_bot/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable eden

# Start the service
sudo systemctl start eden

# Check status
sudo systemctl status eden

# View logs
journalctl -u eden -f
```

## 🔧 Troubleshooting

### Issue 1: "Session closed" or "Protocol error"

**Solution**: The code now automatically retries 3 times with progressive backoff.

If it still fails:
```bash
# Reboot Raspberry Pi
sudo reboot

# Try again
./start-rpi.sh
```

### Issue 2: Browser Crashes or Timeout

**Solution**:
```bash
# Free up memory
sudo systemctl stop unnecessary-services

# Increase memory available to Node.js
export NODE_OPTIONS="--max-old-space-size=768"

# Clear cache
rm -rf ~/.wwebjs_auth ~/.wwebjs_cache
```

### Issue 3: QR Code Not Appearing

**Solution**:
```bash
# The bot has increased QR timeout to 60 seconds
# Just wait a bit longer on Raspberry Pi
# QR will appear after browser fully loads
```

### Issue 4: High CPU Usage

**Solution**:
```bash
# Limit CPU temperature
sudo raspi-config
# Navigate to: Performance Options > Overclock > None

# Monitor temperature
vcgencmd measure_temp
```

### Issue 5: Out of Memory Errors

**Solution**:
```bash
# Increase swap (see Step 3 above)
# Or close other applications:
sudo killall chromium-browser
sudo systemctl stop unused-service
```

## ⚡ Performance Optimization

### 1. Disable Desktop Environment (Headless Mode)

If you're not using the GUI:
```bash
sudo raspi-config
# System Options > Boot/Auto Login > Console
```

### 2. Disable Unnecessary Services

```bash
# List services
sudo systemctl list-unit-files --type=service --state=enabled

# Disable what you don't need:
sudo systemctl disable bluetooth
sudo systemctl disable cups
```

### 3. Overclocking (Advanced)

⚠️ Only if you have proper cooling:
```bash
sudo raspi-config
# Performance Options > Overclock
```

### 4. Use Ethernet Instead of WiFi

Ethernet provides more stable connection for WhatsApp Web.

## 📊 Monitoring

### Check Bot Status
```bash
# If running as service
sudo systemctl status eden

# View real-time logs
journalctl -u eden -f

# Check memory usage
free -h
htop
```

### Check Browser Process
```bash
# See if Chromium is running
ps aux | grep chromium

# Kill stuck browser
pkill chromium-browser
```

## 🔄 Auto-Restart on Failure

The bot now includes automatic retry logic:
- Retries up to 3 times on session errors
- Progressive backoff (5, 10, 15 seconds)
- Helpful error messages with solutions

If using systemd service, it will auto-restart on crash.

## 💡 Best Practices

1. **Use Ethernet** for stable connection
2. **Monitor temperature**: Keep Pi cool (< 70°C)
3. **Regular reboots**: `sudo reboot` weekly
4. **Update regularly**: 
   ```bash
   cd ~/eden_bot
   git pull
   npm install
   sudo systemctl restart eden
   ```
5. **Backup sessions**: 
   ```bash
   cp -r .wwebjs_auth ~/.wwebjs_auth_backup
   ```

## 🐛 Debug Mode

If you need more information:

```bash
# Run with debug output
DEBUG=* node index.js

# Or just Puppeteer debug
DEBUG=puppeteer:* node index.js
```

## 📱 Expected Behavior on Raspberry Pi

- **Startup time**: 1-3 minutes (normal)
- **QR code**: Appears after ~30-60 seconds
- **First message**: May take 5-10 seconds to respond
- **Subsequent messages**: 1-3 seconds response time
- **Memory usage**: ~300-500MB RAM
- **CPU usage**: 20-40% when idle, 60-80% when active

## ✅ Success Indicators

When everything works, you'll see:
```
🍓 Raspberry Pi detected - using optimized settings
🌐 Using browser at: /usr/bin/chromium-browser
🚀 Starting Eden - Your Sarcastic WhatsApp Companion...
✅ WhatsApp Web connected!
👤 Logged in as: Your Name
😈 Eden is ready to roast!
```

## 🆘 Still Having Issues?

1. **Check system resources**:
   ```bash
   free -h      # RAM usage
   df -h        # Disk space
   vcgencmd measure_temp  # CPU temperature
   ```

2. **Fresh start**:
   ```bash
   # Remove sessions and cache
   rm -rf .wwebjs_auth .wwebjs_cache
   
   # Reboot
   sudo reboot
   
   # Try again
   ./start-rpi.sh
   ```

3. **Minimal setup**:
   ```bash
   # Use Raspberry Pi OS Lite (no desktop)
   # Increases available RAM significantly
   ```

## 📝 Quick Reference Commands

```bash
# Start Eden
./start-rpi.sh

# Start as service
sudo systemctl start eden

# Stop service
sudo systemctl stop eden

# View logs
journalctl -u eden -f

# Check status
sudo systemctl status eden

# Restart service
sudo systemctl restart eden

# Monitor resources
htop

# Check temperature
vcgencmd measure_temp

# Free memory
sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'
```

---

**Your Raspberry Pi is now optimized to run Eden reliably! 🍓🤖**
