#!/bin/bash

echo "🍓 Raspberry Pi Chromium Fix Script"
echo "===================================="
echo ""

# Check if running on Raspberry Pi
ARCH=$(uname -m)
if [[ "$ARCH" != "armv7l" ]] && [[ "$ARCH" != "aarch64" ]]; then
    echo "⚠️  This doesn't appear to be a Raspberry Pi"
    echo "   Architecture: $ARCH"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 Step 1: Installing Chromium Browser"
echo "--------------------------------------"
sudo apt-get update
sudo apt-get install -y chromium-browser chromium-chromedriver

echo ""
echo "📦 Step 2: Installing Required Dependencies"
echo "-------------------------------------------"
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

echo ""
echo "📦 Step 3: Installing ffmpeg for music downloads"
echo "-------------------------------------------------"
sudo apt-get install -y ffmpeg

echo ""
echo "📦 Step 4: Checking Chromium installation"
echo "-----------------------------------------"
if command -v chromium-browser &> /dev/null; then
    CHROMIUM_PATH=$(which chromium-browser)
    echo "✅ Chromium found at: $CHROMIUM_PATH"
    echo "   Version: $(chromium-browser --version)"
elif command -v chromium &> /dev/null; then
    CHROMIUM_PATH=$(which chromium)
    echo "✅ Chromium found at: $CHROMIUM_PATH"
    echo "   Version: $(chromium --version)"
else
    echo "❌ Chromium not found!"
    echo "   Please install manually: sudo apt-get install chromium-browser"
    exit 1
fi

echo ""
echo "📦 Step 5: Increasing swap space (recommended)"
echo "----------------------------------------------"
CURRENT_SWAP=$(free -m | awk '/Swap/ {print $2}')
echo "   Current swap: ${CURRENT_SWAP}MB"

if [ "$CURRENT_SWAP" -lt 1024 ]; then
    echo "⚠️  Swap is less than 1GB. Increasing to 1024MB..."
    echo ""
    echo "This will:"
    echo "  1. Stop swap"
    echo "  2. Resize swap file to 1024MB"
    echo "  3. Restart swap"
    echo ""
    read -p "Increase swap space? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo dphys-swapfile swapoff
        sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
        sudo dphys-swapfile setup
        sudo dphys-swapfile swapon
        echo "✅ Swap increased to 1024MB"
    else
        echo "⏭️  Skipped swap increase"
    fi
else
    echo "✅ Swap size is adequate (${CURRENT_SWAP}MB)"
fi

echo ""
echo "📦 Step 6: Installing yt-dlp for music downloads"
echo "------------------------------------------------"
if command -v yt-dlp &> /dev/null; then
    echo "✅ yt-dlp already installed"
    echo "   Version: $(yt-dlp --version)"
else
    echo "Installing yt-dlp..."
    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod a+rx /usr/local/bin/yt-dlp
    echo "✅ yt-dlp installed"
fi

echo ""
echo "🎉 Installation Complete!"
echo "========================"
echo ""
echo "✅ Chromium: $CHROMIUM_PATH"
echo "✅ Dependencies: Installed"
echo "✅ ffmpeg: Installed"
echo "✅ yt-dlp: Installed"
echo "✅ Swap: ${CURRENT_SWAP}MB → $(free -m | awk '/Swap/ {print $2}')MB"
echo ""
echo "📝 Next Steps:"
echo "  1. cd /home/pi/eden_bot (or your bot directory)"
echo "  2. npm install"
echo "  3. npm start"
echo ""
echo "💡 Tips:"
echo "  • Use 'npm start' to run with standard settings"
echo "  • Use './start-rpi.sh' for optimized Raspberry Pi settings"
echo "  • First connection takes 1-3 minutes on Raspberry Pi"
echo "  • Be patient when scanning QR code"
echo ""
echo "🍓 Your Raspberry Pi is now ready to run Eden Bot!"

