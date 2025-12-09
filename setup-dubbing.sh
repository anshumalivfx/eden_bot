#!/bin/bash

# Quick Setup for Piper TTS Dubbing
# Run this script after pulling the code on Raspberry Pi or Mac

echo "🚀 Setting up Piper TTS for voice dubbing..."
echo ""

# Step 1: Check if Groq API key is set
if ! grep -q "GROQ_API_KEY=" .env 2>/dev/null || grep -q "GROQ_API_KEY=your_groq_api_key_here" .env 2>/dev/null; then
    echo "⚠️  GROQ_API_KEY not found in .env file!"
    echo ""
    echo "Please add your Groq API key to .env:"
    echo "GROQ_API_KEY=your_actual_key_here"
    echo ""
    echo "Get free key: https://console.groq.com/keys"
    echo ""
    exit 1
fi

echo "✅ GROQ_API_KEY found in .env"

# Step 2: Install npm dependencies
echo ""
echo "📦 Installing npm packages..."
npm install

# Step 3: Run Piper setup
echo ""
echo "🎤 Downloading Piper TTS models (~500MB)..."
./setup-piper.sh

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎉 You can now use the -dub command!"
echo ""
echo "Test it by replying to a voice message with:"
echo "  -dub hi   (Hindi)"
echo "  -dub es   (Spanish)"
echo "  -dub fr   (French)"
echo ""
