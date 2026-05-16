const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

class BanStore {
  constructor(dbPath = "./database/bans.db") {
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
      CREATE TABLE IF NOT EXISTS bans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        user_jid TEXT NOT NULL,
        user_name TEXT,
        phone_number TEXT,
        group_jid TEXT NOT NULL,
        banned_by TEXT NOT NULL,
        reason TEXT,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_key, group_jid)
      );

      CREATE INDEX IF NOT EXISTS idx_bans_user_group ON bans(user_key, group_jid);
      CREATE INDEX IF NOT EXISTS idx_bans_group ON bans(group_jid);
    `);

    console.log("✅ SQLite ban store initialized");
  }

  static getUserKey(userJid = "") {
    const base = String(userJid).split("@")[0];
    const digitsOnly = base.replace(/[^0-9]/g, "");
    return digitsOnly || base;
  }

  setBan(userJid, groupJid, bannedBy, reason = "", userName = "", phoneNumber = "") {
    const userKey = BanStore.getUserKey(userJid);
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO bans (user_key, user_jid, user_name, phone_number, group_jid, banned_by, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_key, group_jid) DO UPDATE SET
        user_jid = excluded.user_jid,
        user_name = excluded.user_name,
        phone_number = excluded.phone_number,
        banned_by = excluded.banned_by,
        reason = excluded.reason,
        timestamp = excluded.timestamp
    `);

    stmt.run(userKey, userJid, userName, phoneNumber, groupJid, bannedBy, reason, now);
    return { userKey };
  }

  getBan(userJid, groupJid) {
    const userKey = BanStore.getUserKey(userJid);

    const stmt = this.db.prepare(`
      SELECT user_key, user_jid, user_name, phone_number, group_jid, banned_by, reason, timestamp
      FROM bans
      WHERE user_key = ? AND group_jid = ?
      LIMIT 1
    `);

    return stmt.get(userKey, groupJid);
  }

  isBanned(userJid, groupJid) {
    const ban = this.getBan(userJid, groupJid);
    return !!ban;
  }

  clearBan(userJid, groupJid) {
    const userKey = BanStore.getUserKey(userJid);
    const stmt = this.db.prepare(`
      DELETE FROM bans
      WHERE user_key = ? AND group_jid = ?
    `);

    const result = stmt.run(userKey, groupJid);
    return result.changes || 0;
  }

  getGroupBans(groupJid) {
    const stmt = this.db.prepare(`
      SELECT user_key, user_jid, user_name, phone_number, group_jid, banned_by, reason, timestamp
      FROM bans
      WHERE group_jid = ?
      ORDER BY timestamp DESC
    `);

    return stmt.all(groupJid);
  }

  getBanByPhoneNumber(phoneNumber, groupJid) {
    const stmt = this.db.prepare(`
      SELECT user_key, user_jid, user_name, phone_number, group_jid, banned_by, reason, timestamp
      FROM bans
      WHERE (phone_number = ? OR user_key = ?) AND group_jid = ?
      LIMIT 1
    `);

    return stmt.get(phoneNumber, phoneNumber, groupJid);
  }
}

module.exports = BanStore;
