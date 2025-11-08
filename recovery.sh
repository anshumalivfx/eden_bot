#!/bin/bash
# Eden Recovery Script - Use this if bot gets stuck

echo "🔧 Eden Recovery Tool"
echo ""

# Check if bot is running
if pgrep -f "node.*index.js" > /dev/null; then
    echo "⚠️  Eden process is currently running"
    echo "❓ Do you want to stop it? (y/n)"
    read -r response
    if [[ "$response" == "y" ]]; then
        echo "🛑 Stopping Eden..."
        pkill -f "node.*index.js"
        sleep 2
        echo "✅ Eden stopped"
    fi
fi

echo ""
echo "🔍 Checking for issues..."
echo ""

# Check for stale session
if [ -d ".wwebjs_auth" ]; then
    echo "📁 Found existing WhatsApp session"
    echo "❓ Delete session and force re-authentication? (y/n)"
    read -r response
    if [[ "$response" == "y" ]]; then
        echo "🗑️  Deleting session..."
        rm -rf .wwebjs_auth/
        rm -rf .wwebjs_cache/
        echo "✅ Session cleared"
    fi
fi

echo ""
echo "🧹 Clearing temporary files..."
rm -rf temp/*.mp3 temp/*.webp temp/*.jpg temp/*.png 2>/dev/null
echo "✅ Temp files cleared"

echo ""
echo "📋 Recovery options completed!"
echo ""
echo "🚀 Start Eden with one of these commands:"
echo "   1. npm start          - Normal start"
echo "   2. node index.js      - Direct start"
echo "   3. npm run start:rpi  - Raspberry Pi mode (if needed)"
echo ""
echo "💡 Tips:"
echo "   • If stuck at 'Connecting...', wait 2 minutes then stop and retry"
echo "   • If QR code doesn't work, clear session (option 2 above)"
echo "   • If browser crashes, check memory: free -h"
echo ""
