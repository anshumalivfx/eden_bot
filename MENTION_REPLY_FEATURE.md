# 🎯 Mention & Reply Feature

## Overview
Eden Bot now automatically responds to:
1. **Mentions** - When someone mentions "Eden", "Ansh", or tags the bot
2. **Replies** - When someone replies to a bot message

## 🌟 Features

### 1. Mention Detection
The bot will respond when:
- Someone mentions the bot's name in text (Eden, eden, Ansh)
- Someone uses @mentions in group chats
- Multiple trigger words are configured

**Example:**
```
User: "Hey Eden, what do you think about this?"
Eden: *responds with sarcasm*
```

### 2. Reply Detection
The bot will respond when:
- Someone replies/quotes a message from the bot
- Works in both group chats and DMs

**Example:**
```
Eden: "Your code is as messy as your room probably is 🙄"
User: [Replies] "Hey! My code is fine!"
Eden: *responds to the reply*
```

### 3. Context-Aware Responses
- **Owner Recognition**: Special treatment for Ansh (the creator)
  - Less mean but still sarcastic
  - Shows hidden affection (tsundere style)
  
- **Group vs DM**: Bot knows the difference
  - Adapts responses based on chat type
  
- **Previous Message Context**: When replying, bot remembers what it said

### 4. Smart Probability System
- **80% response rate** by default (configurable)
- Prevents spam in active group chats
- Makes bot feel more natural

## 📝 Configuration

### Environment Variables (.env)
```env
# Command prefix for explicit commands
COMMAND_PREFIX=-

# Trigger names for mentions (comma-separated)
TRIGGER_NAMES=Eden,Ansh,@~Ansh

# Probability of responding (0.0 to 1.0)
RESPONSE_PROBABILITY=0.8
```

### Default Settings
- **Command Prefix**: `-` (dash)
- **Trigger Names**: Eden, eden, Ansh, @~Ansh
- **Response Probability**: 80%

## 🎭 Response Examples

### Normal User Mention
```
User: "Eden, can you help me with this code?"
Eden: "Oh look, someone needs my help. How surprising. What's the issue this time? 🙄"
```

### Owner Mention
```
Ansh: "Eden, what do you think?"
Eden: "Well, since it's you asking... I suppose I can grace you with my opinion. 😏"
```

### Reply to Bot
```
Eden: "That's the worst idea I've heard all day."
User: [Replies] "It's not that bad!"
Eden: "Oh sweetie, denial isn't just a river in Egypt. 🤦‍♀️"
```

### Group Chat Mention
```
[Group Chat]
User1: "Has anyone seen Eden?"
Eden: "I'm always watching. Always judging. Mostly judging. 👀"
```

## 🔧 Technical Details

### How It Works
1. **Message Reception**: Bot receives all messages
2. **Filter Checks**: 
   - Skip status broadcasts
   - Skip own messages
3. **Command Detection**: Check for command prefix first
4. **Mention/Reply Check**:
   - Check for @mentions using `getMentions()`
   - Check for name in text body
   - Check if message quotes a bot message
5. **Probability Check**: Random check against configured probability
6. **Context Generation**: Build context based on:
   - Mention type (mention vs reply)
   - Sender identity (owner vs normal user)
   - Chat type (group vs DM)
   - Previous message (if reply)
7. **Response Generation**: Use LLM to generate contextual response
8. **Reply**: Send response back to the chat

### Code Structure
```javascript
// Main flow
client.on("message", async (message) => {
  // 1. Skip broadcasts and own messages
  // 2. Check for commands (prefix-based)
  // 3. Check for mentions/replies
  // 4. Generate contextual response
  // 5. Reply to message
});

// Helper functions
- isBotMentioned(message) - Checks mentions and name triggers
- isReplyToBot(message) - Checks if replying to bot
- getSenderName(message) - Gets user's name
- isOwner(senderName) - Checks if user is owner
```

## 🚀 Usage

### In Direct Messages
```
User: "Eden, tell me a joke"
Eden: *responds naturally*

User: "Eden"
Eden: "Yes? What now? 🙄"
```

### In Group Chats
```
[Group: Developers]
Alice: "Hey @Eden, what do you think about TypeScript?"
Eden: "TypeScript? Oh look, JavaScript grew up and learned about types. How adorable! 😏"

Bob: [Replies to Eden's message] "TypeScript is great!"
Eden: "Of course you think so. You probably also think pineapple belongs on pizza. 🍕"
```

### Commands Still Work
```
User: "-help"
Eden: *shows help menu*

User: "-roast"
Eden: *roasts the user*

User: "-sticker"
Eden: *creates sticker*
```

## 🎯 Benefits

1. **More Interactive**: Bot feels more alive and engaged
2. **Natural Conversations**: Responds like a real participant
3. **Group Chat Ready**: Perfect for group dynamics
4. **Context-Aware**: Remembers conversation flow
5. **Owner Special Treatment**: Creator gets unique interactions
6. **Spam Prevention**: Probability system prevents overresponding

## ⚙️ Customization

### Change Response Rate
Edit `.env`:
```env
RESPONSE_PROBABILITY=0.5  # 50% response rate
```

### Add More Triggers
Edit `.env`:
```env
TRIGGER_NAMES=Eden,Bot,Assistant,Helper
```

### Change Command Prefix
Edit `.env`:
```env
COMMAND_PREFIX=!  # Use ! instead of -
```

## 🐛 Troubleshooting

### Bot Not Responding to Mentions
1. Check trigger names in `.env`
2. Verify bot ID is set correctly
3. Check probability setting (might be too low)
4. Ensure LLM service is working

### Bot Responding Too Much
1. Lower `RESPONSE_PROBABILITY` in `.env`
2. Remove some trigger names
3. Use more specific trigger words

### Bot Not Detecting Replies
1. Ensure `hasQuotedMsg` is working
2. Check WhatsApp Web.js version
3. Verify message quote detection

## 📊 Statistics

The bot tracks:
- Total messages received
- Commands executed
- Mentions detected
- Replies detected
- Response rate

Use `-status` command to see stats!

## 🔮 Future Enhancements

Potential improvements:
- [ ] Learn from conversation history
- [ ] Multiple personality modes per user
- [ ] Scheduled automated messages
- [ ] Advanced context memory
- [ ] Multi-language support
- [ ] Sentiment analysis for better responses

## 📝 Notes

- Bot requires WhatsApp Web.js to function
- Works with official WhatsApp numbers (no Business API needed)
- Uses free LLM providers (Groq recommended)
- Respects WhatsApp rate limits
- Can be deployed on Raspberry Pi

---

**Made with 😈 by Eden - Your Sarcastic AI Companion**
