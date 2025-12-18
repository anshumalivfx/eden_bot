#!/bin/bash

# 🎤 Whisper Installation Script for Eden Bot
# This script installs faster-whisper for on-device transcription
# faster-whisper is compatible with Python 3.12 and 4x faster than openai-whisper

echo "🎤 Eden Bot - faster-whisper Installation"
echo "=========================================="
echo ""

# Check Python version
echo "📋 Checking Python version..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed!"
    echo "   Please install Python 3.8 or higher first."
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "✅ Found Python $PYTHON_VERSION"
echo ""

# Check pip3
echo "📋 Checking pip3..."
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed!"
    echo "   Please install pip3 first."
    exit 1
fi
echo "✅ pip3 is available"
echo ""

# Install faster-whisper
echo "📦 Installing faster-whisper..."
echo "   ✨ Benefits:"
echo "      • Python 3.12 compatible"
echo "      • 4x faster than openai-whisper"
echo "      • Lower memory usage"
echo "   This may take a few minutes..."
echo ""

pip3 install --upgrade faster-whisper

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Failed to install faster-whisper!"
    echo "   Try manually: pip3 install faster-whisper"
    exit 1
fi

echo ""
echo "✅ faster-whisper installed successfully!"
echo ""

# Verify installation
echo "🔍 Verifying installation..."
python3 -c "from faster_whisper import WhisperModel; print('✅ faster-whisper import successful!')" 2>&1

if [ $? -ne 0 ]; then
    echo "❌ faster-whisper verification failed!"
    exit 1
fi

echo ""
echo "🎉 Installation Complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Edit .env file and set:"
echo "      DUB_TRANSCRIPTION_ENGINE=whisper-local"
echo ""
echo "   2. Test with: -dub hindi (reply to any voice note)"
echo ""
echo "   3. Run: node test-whisper.js to verify installation"
echo "   4. See WHISPER_SETUP.md for more info"
echo ""
echo "💡 Whisper models will download automatically on first use (~142 MB)"
echo ""
