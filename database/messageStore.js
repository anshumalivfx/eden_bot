const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

class MessageStore {
  constructor(dbPath = "./database/messages.db") {
    // Ensure database directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL"); // Better performance

    this.initTables();
  }

  initTables() {
    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_jid TEXT,
        message TEXT,
        is_bot INTEGER DEFAULT 0,
        message_id TEXT,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sender_jid ON messages(sender_jid);
      CREATE INDEX IF NOT EXISTS idx_message_id ON messages(message_id);
    `);

    console.log("✅ SQLite message store initialized");
  }

  // Add a message to the database
  addMessage(
    chatId,
    senderName,
    message,
    isBot = false,
    messageId = null,
    senderJid = null
  ) {
    // Check if message already exists (prevent duplicates)
    if (messageId) {
      const existing = this.db
        .prepare("SELECT id FROM messages WHERE message_id = ? AND chat_id = ?")
        .get(messageId, chatId);
      if (existing) {
        return; // Message already stored, skip
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO messages (chat_id, sender_name, sender_jid, message, is_bot, message_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        chatId,
        senderName,
        senderJid,
        message,
        isBot ? 1 : 0,
        messageId,
        Date.now()
      );
    } catch (error) {
      console.error("Error adding message to database:", error);
    }
  }

  // Get conversation context (optionally filtered by user) - with deduplication
  getContext(chatId, targetUser = null, limit = 15) {
    let query;
    let params;

    if (targetUser) {
      // Get messages between bot and specific user only, deduplicated
      query = `
        SELECT sender_name, sender_jid, message, is_bot, message_id, timestamp
        FROM messages
        WHERE chat_id = ? AND (is_bot = 1 OR sender_name = ? OR sender_jid = ?)
        AND id IN (
          SELECT MIN(id) FROM messages
          WHERE chat_id = ? AND (is_bot = 1 OR sender_name = ? OR sender_jid = ?)
          GROUP BY message, sender_name, timestamp
        )
        ORDER BY timestamp DESC
        LIMIT ?
      `;
      params = [
        chatId,
        targetUser,
        targetUser,
        chatId,
        targetUser,
        targetUser,
        limit,
      ];
    } else {
      // Get all recent messages, deduplicated
      query = `
        SELECT sender_name, sender_jid, message, is_bot, message_id, timestamp
        FROM messages
        WHERE chat_id = ?
        AND id IN (
          SELECT MIN(id) FROM messages
          WHERE chat_id = ?
          GROUP BY message, sender_name, timestamp
        )
        ORDER BY timestamp DESC
        LIMIT ?
      `;
      params = [chatId, chatId, limit];
    }

    const messages = this.db.prepare(query).all(...params);
    return messages.reverse(); // Return in chronological order
  }

  // Clean old messages (keep last 100 per chat)
  cleanOldMessages() {
    const stmt = this.db.prepare(`
      DELETE FROM messages
      WHERE id NOT IN (
        SELECT id FROM messages
        WHERE chat_id = ?
        ORDER BY timestamp DESC
        LIMIT 100
      ) AND chat_id = ?
    `);

    // Get all unique chat IDs
    const chats = this.db
      .prepare("SELECT DISTINCT chat_id FROM messages")
      .all();

    for (const { chat_id } of chats) {
      try {
        stmt.run(chat_id, chat_id);
      } catch (error) {
        console.error("Error cleaning old messages:", error);
      }
    }
  }

  // Get stats
  getStats() {
    const totalMessages = this.db
      .prepare("SELECT COUNT(*) as count FROM messages")
      .get().count;
    const totalChats = this.db
      .prepare("SELECT COUNT(DISTINCT chat_id) as count FROM messages")
      .get().count;
    return { totalMessages, totalChats };
  }

  // Remove duplicate messages (keep oldest entry for each unique message)
  removeDuplicates(chatId = null) {
    const query = chatId
      ? `DELETE FROM messages 
         WHERE id NOT IN (
           SELECT MIN(id) FROM messages 
           WHERE chat_id = ?
           GROUP BY message, sender_name, timestamp
         ) AND chat_id = ?`
      : `DELETE FROM messages 
         WHERE id NOT IN (
           SELECT MIN(id) FROM messages 
           GROUP BY message, sender_name, timestamp
         )`;

    const params = chatId ? [chatId, chatId] : [];
    const stmt = this.db.prepare(query);
    const result = stmt.run(...params);
    console.log(
      `🗑️ Removed ${result.changes} duplicate messages${
        chatId ? ` from ${chatId}` : ""
      }`
    );
    return result.changes;
  }

  // Close database connection
  close() {
    this.db.close();
  }
}

module.exports = MessageStore;
