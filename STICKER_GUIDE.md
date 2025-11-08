# 🎨 Eden's Enhanced Sticker Creation Feature

Eden can now create WhatsApp stickers from images, GIFs, videos, AND text messages with her signature sarcastic commentary!

## 🖼️ How to Use

### Method 1: Media Stickers (Direct)
1. **Send an image, GIF, or video** to any chat where Eden is present
2. **Use the sticker command**:
   ```
   -sticker
   ```
   or use the short alias:
   ```
   -s2
   ```

### Method 2: Reply to Create Stickers
1. **Reply to ANY message** (text or media) with the sticker command
2. **For text messages**: Creates a message box sticker
3. **For media messages**: Creates a media sticker

### Supported Content Types
- 📸 **Images**: JPG, PNG, WebP, etc. → Media sticker
- 🎞️ **GIFs**: Animated GIFs → Animated media sticker  
- 🎥 **Videos**: MP4, MOV, AVI, etc. → Animated media sticker (3 seconds)
- 💬 **Text Messages**: Any text → Message box sticker

## 🎭 Two Types of Stickers

### 📱 Message Box Stickers (NEW!)
When you reply to a text message with `-sticker`:
- **Beautiful message box design** with sender's name
- **6 random color themes** (classic, dark, blue, green, purple, orange)
- **Auto text wrapping** for long messages
- **Quote-style formatting** with speech bubbles
- **Perfect for memorable quotes** and funny messages

### 🖼️ Media Stickers
When you reply to media or send media directly:
- **Professional resizing** to 512x512 pixels
- **Maintains quality** with 90% WebP compression
- **Preserves animations** for GIFs and videos
- **Transparent backgrounds** supported

## 🎭 Eden's Sticker Responses

Eden will respond with one of her sarcastic comments while processing:

**Processing Messages:**
- "🎨 Eden is begrudgingly processing your media into a sticker... This better be worth it."

**Success Messages:**
- "Oh great, another masterpiece. 🎨"
- "I've turned your image into something slightly less disappointing."
- "Here's your sticker. Try not to spam it too much."
- "Congratulations, you've discovered the sticker feature. Revolutionary!"
- "I've processed your image with the enthusiasm of a sloth."
- "Your sticker is ready. It's about as exciting as you'd expect."

**Error Messages:**
- "Well, that didn't work. Your media broke my processing. Congratulations! 💥"
- "I tried to make your sticker, but something went wrong. Typical. 🙄"
- "Your media is either corrupted or I'm having a bad day. Probably both. 😤"

## 🔧 Technical Details

### Image Processing
- **Resize**: Automatically resized to 512x512 pixels (sticker standard)
- **Format**: Converted to WebP format for WhatsApp compatibility
- **Quality**: 90% quality for optimal balance
- **Background**: Transparent background maintained

### GIF Processing
- **Animation**: Preserves animation in sticker format
- **Resize**: Smart scaling to fit 512x512 while maintaining aspect ratio
- **Loop**: Infinite loop animation
- **Optimization**: Optimized for WhatsApp sticker requirements

### Video Processing
- **Duration**: Limited to first 3 seconds (sticker limit)
- **Resize**: Scaled to sticker dimensions
- **Format**: Converted to animated WebP
- **Audio**: Audio stripped (stickers don't support audio)

## 💡 Usage Examples

### Example 1: Image Sticker
```
User: [sends a photo of their cat]
User: -sticker
Eden: 🎨 Eden is begrudgingly processing your media into a sticker...
Eden: [sends cat sticker]
Eden: I've turned your image into something slightly less disappointing.
```

### Example 2: GIF Sticker
```
User: [sends a funny reaction GIF]
User: -s2
Eden: 🎨 Eden is begrudgingly processing your media into a sticker...
Eden: [sends animated sticker]
Eden: Here's your sticker. Try not to spam it too much.
```

### Example 3: Video Sticker
```
User: [sends a short video clip]
User: -sticker
Eden: 🎨 Eden is begrudgingly processing your media into a sticker...
Eden: [sends animated sticker from first 3 seconds]
Eden: Oh great, another masterpiece. 🎨
```

## 🚨 Error Handling

### No Media Error
```
User: -sticker
Eden: User, I need an image, GIF, or video to make a sticker. Send me something visual first, then use the command! 📸
```

### Unsupported Format
```
User: [sends audio file]
User: -sticker
Eden: I can only work with images, GIFs, or videos. What you sent me is... questionable. 🤔
```

### Processing Error
```
User: [sends corrupted file]
User: -sticker
Eden: Well, that didn't work. Your media broke my processing. Congratulations! 💥
```

## ⚙️ Configuration

The sticker feature works automatically with no additional configuration needed. All processing is done locally using:

- **Sharp**: For image processing and resizing
- **FFmpeg**: For GIF and video conversion
- **WebP**: For WhatsApp-compatible sticker format

## 📁 File Management

- **Temporary files** are created during processing
- **Automatic cleanup** removes temp files after processing
- **Error handling** ensures cleanup even if processing fails
- **Temp directory**: `/temp/` (automatically created and gitignored)

## 🎯 Pro Tips

1. **Best Quality**: Use high-resolution images for better sticker quality
2. **GIF Optimization**: Shorter GIFs work better and process faster
3. **Video Length**: Only first 3 seconds of videos are used
4. **File Size**: Smaller files process faster
5. **Spam Control**: Eden will mock you if you overuse the feature! 😈

## 🐛 Troubleshooting

### Installation Issues
If sticker creation fails, ensure dependencies are installed:
```bash
npm install
```

### FFmpeg Issues
The bot includes ffmpeg-static, but if you have issues:
- macOS: `brew install ffmpeg`
- Linux: `sudo apt-get install ffmpeg`
- Windows: Download from FFmpeg website

### Memory Issues
Large files may cause memory issues. Keep media files under 50MB for best results.

## 🎉 Have Fun!

Now you can create custom stickers with Eden's sarcastic commentary. Perfect for making your group chats even more entertaining! 

Remember: Eden will judge your media choices, but she'll still make your stickers! 😈💖
