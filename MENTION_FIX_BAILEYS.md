# Mention Name Resolution Fix for Baileys

## Problem
Mentions in group chats were showing weird IDs instead of actual names (e.g., @22217882616014 or @179082956406844 instead of @Vishakha).

## Root Cause
In Baileys, user display names (pushNames) are **NOT** stored in group metadata. The `groupMetadata.participants` array only contains:
- `id`: The JID (e.g., "1234567890@s.whatsapp.net")
- `phoneNumber`: Phone number (for PN users)
- `lid`: LID (for LID users)  
- `admin`: Admin status

**It does NOT contain display names/pushNames.**

Instead, Baileys provides contact information through:
1. **`contacts.update` event** - Emitted when contact info is received
2. **`message.pushName` field** - Available in each message
3. **History sync** - Processed during initial connection

## Solution

### 1. Contact Name Cache
Implemented a Map to cache JID → display name mappings:
```javascript
const contactNameCache = new Map();
```

### 2. Listen to Baileys Contact Events
Baileys automatically emits `contacts.update` events with contact information:

```javascript
sock.ev.on("contacts.update", (updates) => {
  for (const update of updates) {
    if (update.notify || update.name) {
      const displayName = update.notify || update.name;
      // Cache using all possible ID formats (id, lid, phoneNumber)
      contactNameCache.set(update.id, displayName);
      contactNameCache.set(update.lid, displayName);
      contactNameCache.set(update.phoneNumber, displayName);
    }
  }
});
```

### 3. Cache on Message Receipt
When any message is received, cache the sender's pushName:
```javascript
if (message.pushName) {
  const senderJid = message.key.participant || message.key.remoteJid;
  contactNameCache.set(senderJid, message.pushName);
}
```

### 3. Extract Names from Message Text
When processing mentions, extract the actual name the user typed:
```javascript
// Extract "@Vishakha" → "Vishakha"
const atRegex = /@([^\s]+)/g;
const namesInText = [];
let match;
while ((match = atRegex.exec(messageText)) !== null) {
  namesInText.push(match[1]);
}
```

### 4. LID Support
Handle LID addressing mode in groups:

```javascript
// Map LID to phone number using group metadata
const participant = groupParticipants.find(p => p.lid === jid);
if (participant && participant.id) {
  // Use participant.id (phone number JID) for cache lookups
}
```

### 5. Priority System
1. **Text extraction** (what user typed like "@Vishakha", but skip if it's just numbers)
2. **Cache lookup** (from contacts.update events or message pushNames)
3. **Phone number** (fallback - cleaned format for LIDs)

## How Baileys Works

According to the official Baileys source code:
- Display names come from `message.pushName` field
- Group metadata only has participant JIDs and admin status
- Names must be cached from messages or extracted from message text
- WhatsApp displays mentions as "@Name" in the message text itself

## Files Modified
- `index.js`: 
  - Added contactNameCache Map
  - Added `contacts.update` event listener (automatic contact sync from Baileys)
  - Updated getMentions() with LID support and cache lookups
  - Added pushName caching in message handler with bidirectional LID↔PN mapping

## Result
Now mentions work correctly:
- ✅ Automatically syncs contact names via Baileys `contacts.update` events
- ✅ Handles LID addressing mode in groups (maps LID to phone numbers)
- ✅ Extracts actual names from message text when available
- ✅ Caches names using multiple ID formats (id, lid, phoneNumber)
- ✅ Falls back to clean phone number format if name not available
- ✅ Compatible with Baileys v6.7+ architecture

## How It Works Now
1. **On Connection**: Baileys sends contact info through `contacts.update` → cached automatically
2. **On Message**: PushName extracted and cached with bidirectional LID↔PN mapping
3. **On Mention**: Check cache first, extract from text second, show number as fallback
4. **LID Groups**: Map LID to phone number JID, use phone JID for cache lookups
