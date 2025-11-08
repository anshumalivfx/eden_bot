#!/bin/bash
# Eden WhatsApp Bot - Raspberry Pi Startup Script

echo "🍓 Starting Eden on Raspberry Pi..."
echo ""

# Check if Chromium is installed
if ! command -v chromium-browser &> /dev/null && ! command -v chromium &> /dev/null; then
    echo "⚠️  Chromium not found!"
    echo "📦 Installing Chromium..."
    sudo apt-get update
    sudo apt-get install -y chromium-browser
    echo "✅ Chromium installed"
    echo ""
fi

# Check memory
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
FREE_MEM=$(free -m | awk '/^Mem:/{print $4}')
SWAP_SIZE=$(free -m | awk '/^Swap:/{print $2}')

echo "💾 System Memory Status:"
echo "   Total RAM: ${TOTAL_MEM}MB"
echo "   Free RAM: ${FREE_MEM}MB"
echo "   Swap Size: ${SWAP_SIZE}MB"
echo ""

# Warn if low memory
if [ $FREE_MEM -lt 200 ]; then
    echo "⚠️  Low free memory detected!"
    echo "💡 Consider freeing up RAM or increasing swap space"
    echo ""
fi

if [ $SWAP_SIZE -lt 512 ]; then
    echo "⚠️  Small swap space detected!"
    echo "💡 Recommended: Increase swap to at least 1024MB"
    echo "   Run: sudo dphys-swapfile swapoff"
    echo "   Edit: sudo nano /etc/dphys-swapfile"
    echo "   Set: CONF_SWAPSIZE=1024"
    echo "   Run: sudo dphys-swapfile setup && sudo dphys-swapfile swapon"
    echo ""
fi

# Set Node.js memory limits for Raspberry Pi
export NODE_OPTIONS="--max-old-space-size=512"

echo "🚀 Starting Eden with optimized settings..."
echo "⏳ This may take 1-2 minutes on Raspberry Pi..."
echo ""

# Start the bot
node index.js

# If it fails, provide troubleshooting
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Eden failed to start"
    echo "🔧 Troubleshooting:"
    echo "   1. Reboot: sudo reboot"
    echo "   2. Check logs: journalctl -u eden"
    echo "   3. Free memory: sudo systemctl stop unnecessary-service"
    echo "   4. Run manually: NODE_OPTIONS='--max-old-space-size=512' node index.js"
fi
