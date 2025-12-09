#!/bin/bash

# Piper TTS Setup Script for Raspberry Pi & Mac
# This script downloads Piper binary and voice models for dubbing feature

set -e  # Exit on error

echo "🎙️ Setting up Piper TTS..."

# Detect architecture
ARCH=$(uname -m)
OS=$(uname -s)

echo "📡 Detected: $OS $ARCH"

# Create directories
mkdir -p piper piper-models

cd piper

# Download Piper binary based on architecture
if [ "$OS" = "Linux" ]; then
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        # Raspberry Pi 64-bit
        echo "📥 Downloading Piper for Raspberry Pi (aarch64)..."
        PIPER_URL="https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_aarch64.tar.gz"
    elif [ "$ARCH" = "armv7l" ]; then
        # Raspberry Pi 32-bit
        echo "📥 Downloading Piper for Raspberry Pi (armv7l)..."
        PIPER_URL="https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_armv7l.tar.gz"
    elif [ "$ARCH" = "x86_64" ]; then
        # Linux x64
        echo "📥 Downloading Piper for Linux x64..."
        PIPER_URL="https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_x86_64.tar.gz"
    else
        echo "❌ Unsupported Linux architecture: $ARCH"
        exit 1
    fi
elif [ "$OS" = "Darwin" ]; then
    # macOS
    echo "📥 Downloading Piper for macOS..."
    PIPER_URL="https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_macos_x64.tar.gz"
else
    echo "❌ Unsupported OS: $OS"
    exit 1
fi

# Download and extract Piper
if [ ! -f "piper" ]; then
    echo "⬇️  Downloading Piper..."
    curl -L "$PIPER_URL" -o piper.tar.gz
    tar -xzf piper.tar.gz
    rm piper.tar.gz
    chmod +x piper
    echo "✅ Piper binary installed"
else
    echo "✅ Piper binary already exists"
fi

cd ../piper-models

# Download voice models for multiple languages
echo ""
echo "📦 Downloading Piper voice models..."
echo "This will download ~500MB of models for multiple languages"
echo ""

# Function to download model
download_model() {
    local MODEL=$1
    local LANG=$2
    
    if [ ! -f "${MODEL}.onnx" ]; then
        echo "⬇️  Downloading $LANG model: $MODEL..."
        curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/main/${MODEL//-/\/}/${MODEL}.onnx" -o "${MODEL}.onnx"
        curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/main/${MODEL//-/\/}/${MODEL}.onnx.json" -o "${MODEL}.onnx.json"
        echo "✅ $LANG model downloaded"
    else
        echo "✅ $LANG model already exists"
    fi
}

# Download essential models
download_model "en_US-lessac-medium" "English (US)"
download_model "hi_IN-ravidas-medium" "Hindi"
download_model "es_ES-davefx-medium" "Spanish"
download_model "fr_FR-siwis-medium" "French"
download_model "de_DE-thorsten-medium" "German"
download_model "it_IT-riccardo-x_low" "Italian"
download_model "pt_BR-faber-medium" "Portuguese"
download_model "ru_RU-dmitri-medium" "Russian"
download_model "ja_JP-natasha-medium" "Japanese"
download_model "zh_CN-huayan-medium" "Chinese"
download_model "ar_JO-kareem-medium" "Arabic"

echo ""
echo "✅ Piper TTS setup complete!"
echo ""
echo "📁 Installed:"
echo "   - Piper binary: piper/piper"
echo "   - Voice models: piper-models/*.onnx"
echo ""
echo "🎉 You can now use the -dub command!"
echo ""
