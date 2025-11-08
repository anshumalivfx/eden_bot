#!/bin/bash

echo "🚀 Setting up WhatsApp Mean Bot..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm found"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Check if .env file exists and has been configured
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

echo ""
echo "🔧 Please configure your .env file with at least one LLM provider:"
echo ""
echo "Option 1 - OpenAI (best quality, paid):"
echo "  Get API key from: https://platform.openai.com/api-keys"
echo "  Add to .env: OPENAI_API_KEY=your_key_here"
echo ""
echo "Option 2 - Groq (good quality, free):"
echo "  Get API key from: https://console.groq.com/"
echo "  Add to .env: GROQ_API_KEY=your_key_here"
echo ""
echo "Option 3 - Ollama (local, free):"
echo "  Install: brew install ollama"
echo "  Setup: ollama pull llama2 && ollama serve"
echo ""

# Check if any API key is configured
if grep -q "your_.*_api_key_here" .env; then
    echo "⚠️  WARNING: Please replace placeholder API keys in .env file"
    echo "   The bot will use fallback responses until you configure an LLM provider"
fi

echo ""
echo "🎉 Setup complete! To start the bot:"
echo "   npm start"
echo ""
echo "📱 After starting, scan the QR code with WhatsApp on your phone"
