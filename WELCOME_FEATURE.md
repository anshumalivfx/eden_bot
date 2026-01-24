# Welcome Feature Documentation

## Overview
The Eden bot now automatically welcomes new members when they join a group, mentioning them and displaying the group rules.

## How It Works

### Event Listener
The bot listens for the `group-participants.update` event from Baileys, which is triggered when:
- Someone joins a group (action: `add`)
- Someone leaves a group (action: `remove`)
- Someone is promoted to admin (action: `promote`)
- Someone is demoted from admin (action: `demote`)

### Welcome Trigger
The welcome message is sent only when the action is `add`, indicating new member(s) have joined.

### Message Format
When someone joins, the bot sends this message while mentioning all new members:

```
Imp *Pls no sensitive/SEXUAL DISCUSSION here.*
*No 18+ stickers/sometimes you can*
*no ragebait*
* Avoid saying negative things here *
Happy good vibes only ✨
No DMs anyone without consent guys

Violators will be shamed publicly
```

### Mention Mechanism
The bot uses the same mention mechanism as the roast feature:
- Takes the participant JIDs from the event
- Passes them in the `mentions` array when sending the message
- WhatsApp automatically formats these as @mentions in the message

## Implementation Details

### Code Location
File: `index.js`
Location: After the `creds.update` event handler (around line 683)

### Event Structure
```javascript
{
  id: string,           // Group JID (e.g., "1234567890@g.us")
  participants: string[], // Array of JIDs who joined
  action: 'add',        // Action type
  author: string        // JID of person who added them
}
```

### Error Handling
- Wrapped in try-catch to prevent crashes
- Logs errors to console for debugging
- Continues bot operation even if welcome fails

## Testing

### Using the Test Script
Run the test script to verify the feature is configured:
```bash
node test-welcome.js
```

### Live Testing
1. Start the bot: `node index.js` or `npm start`
2. Add someone to a group where the bot is a member
3. The bot should automatically send the welcome message mentioning the new member

### Expected Console Output
When someone joins:
```
👋 New member(s) joined group 1234567890@g.us: 1234567890@s.whatsapp.net
✅ Welcome message sent to 1234567890@g.us
```

## Customization

### Changing the Welcome Message
Edit the `welcomeMessage` variable in `index.js` (around line 695):
```javascript
const welcomeMessage = `Your custom message here
You can use *bold* formatting
And multiple lines`;
```

### Disabling for Specific Groups
Add a filter before sending:
```javascript
if (action === "add") {
  // Skip certain groups
  const excludedGroups = ["group1@g.us", "group2@g.us"];
  if (excludedGroups.includes(groupJid)) {
    return;
  }
  // ... rest of code
}
```

### Adding Group Name to Message
```javascript
// Get group metadata
const groupMetadata = await sock.groupMetadata(groupJid);
const groupName = groupMetadata.subject;

const welcomeMessage = `Welcome to ${groupName}! 🎉

Your rules here...`;
```

## Comparison with Roast Feature

### Similarities
Both features use the `mentions` array to tag users:
- Roast: Mentions the target of the roast
- Welcome: Mentions all new members

### Differences
- **Roast**: Command-triggered, user-initiated
- **Welcome**: Event-triggered, automatic
- **Roast**: Can mention one specific person
- **Welcome**: Mentions all new members at once

## Troubleshooting

### Welcome message not sent
1. Check if bot is admin in the group
2. Verify bot is authenticated and connected
3. Check console for error messages
4. Ensure group JID is valid

### Mentions not working
1. Verify participant JIDs are valid
2. Check if bot has permission to mention
3. Ensure mentions array is properly formatted

### Message sent but not formatted
- WhatsApp markdown formatting requires:
  - `*text*` for bold
  - `_text_` for italic
  - `~text~` for strikethrough

## Security Considerations
- Welcome feature only activates on `add` action
- Does not expose user data
- No external API calls required
- Minimal performance impact

## Future Enhancements
Possible additions:
- Custom welcome messages per group
- Welcome images/stickers
- Personalized messages based on user
- Time-based welcome messages
- Admin notifications
- Member count tracking
