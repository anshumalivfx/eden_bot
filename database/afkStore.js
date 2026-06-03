const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

class AfkStore {
  constructor(dbPath = "./database/afk.db") {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    this.initTables();
  }

  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS afk_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        user_jid TEXT NOT NULL,
        user_name TEXT,
        group_jid TEXT NOT NULL,
        reason TEXT,
        started_at INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_key, group_jid)
      );

      CREATE INDEX IF NOT EXISTS idx_afk_user_group ON afk_status(user_key, group_jid);
      CREATE INDEX IF NOT EXISTS idx_afk_group ON afk_status(group_jid);
      CREATE INDEX IF NOT EXISTS idx_afk_started_at ON afk_status(started_at);

      CREATE TABLE IF NOT EXISTS afk_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_user_key TEXT NOT NULL,
        target_user_jid TEXT NOT NULL,
        group_jid TEXT NOT NULL,
        sender_jid TEXT NOT NULL,
        sender_name TEXT,
        message_text TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_afk_messages_target_group ON afk_messages(target_user_key, group_jid);
      CREATE INDEX IF NOT EXISTS idx_afk_messages_timestamp ON afk_messages(timestamp);
    `);

    console.log("✅ SQLite AFK store initialized");
  }

  static getUserKey(userJid = "") {
    const base = String(userJid).split("@")[0];
    const digitsOnly = base.replace(/[^0-9]/g, "");
    return digitsOnly || base;
  }

  setAfk(userJid, groupJid, userName = "", reason = "") {
    const userKey = AfkStore.getUserKey(userJid);
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO afk_status (user_key, user_jid, user_name, group_jid, reason, started_at, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_key, group_jid) DO UPDATE SET
        user_jid = excluded.user_jid,
        user_name = excluded.user_name,
        reason = excluded.reason,
        started_at = excluded.started_at,
        timestamp = excluded.timestamp
    `);

    stmt.run(userKey, userJid, userName, groupJid, reason, now, now);
    return { startedAt: now, userKey };
  }

  getAfk(userJid, groupJid) {
    const userKey = AfkStore.getUserKey(userJid);

    const stmt = this.db.prepare(`
      SELECT user_key, user_jid, user_name, group_jid, reason, started_at, timestamp
      FROM afk_status
      WHERE user_key = ? AND group_jid = ?
      LIMIT 1
    `);

    return stmt.get(userKey, groupJid) || null;
  }

  isAfk(userJid, groupJid) {
    return !!this.getAfk(userJid, groupJid);
  }

  clearAfk(userJid, groupJid) {
    const userKey = AfkStore.getUserKey(userJid);
    const stmt = this.db.prepare(`
      DELETE FROM afk_status
      WHERE user_key = ? AND group_jid = ?
    `);

    const result = stmt.run(userKey, groupJid);
    return result.changes || 0;
  }

  addAfkMessage(targetJid, groupJid, senderJid, senderName, messageText) {
    const targetUserKey = AfkStore.getUserKey(targetJid);
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO afk_messages (
        target_user_key,
        target_user_jid,
        group_jid,
        sender_jid,
        sender_name,
        message_text,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      targetUserKey,
      targetJid,
      groupJid,
      senderJid,
      senderName || "Unknown",
      messageText,
      now,
    );

    return { timestamp: now };
  }

  getAfkMessages(targetJid, groupJid) {
    const targetUserKey = AfkStore.getUserKey(targetJid);
    const stmt = this.db.prepare(`
      SELECT target_user_key, target_user_jid, group_jid, sender_jid, sender_name, message_text, timestamp
      FROM afk_messages
      WHERE target_user_key = ? AND group_jid = ?
      ORDER BY timestamp ASC
    `);

    return stmt.all(targetUserKey, groupJid);
  }

  clearAfkMessages(targetJid, groupJid) {
    const targetUserKey = AfkStore.getUserKey(targetJid);
    const stmt = this.db.prepare(`
      DELETE FROM afk_messages
      WHERE target_user_key = ? AND group_jid = ?
    `);

    const result = stmt.run(targetUserKey, groupJid);
    return result.changes || 0;
  }

  formatDuration(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));

    if (totalMinutes < 1) {
      return "less than a minute";
    }

    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
    if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);

    return parts.slice(0, 2).join(" ") || "less than a minute";
  }
}

module.exports = AfkStore;