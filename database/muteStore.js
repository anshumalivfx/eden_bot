const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

class MuteStore {
  constructor(dbPath = "./database/mutes.db") {
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
      CREATE TABLE IF NOT EXISTS mutes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        user_jid TEXT NOT NULL,
        user_name TEXT,
        group_jid TEXT NOT NULL,
        muted_by TEXT NOT NULL,
        reason TEXT,
        expires_at INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_key, group_jid)
      );

      CREATE INDEX IF NOT EXISTS idx_mutes_user_group ON mutes(user_key, group_jid);
      CREATE INDEX IF NOT EXISTS idx_mutes_group ON mutes(group_jid);
      CREATE INDEX IF NOT EXISTS idx_mutes_expires_at ON mutes(expires_at);
    `);

    console.log("✅ SQLite mute store initialized");
  }

  static getUserKey(userJid = "") {
    const base = String(userJid).split("@")[0];
    const digitsOnly = base.replace(/[^0-9]/g, "");
    return digitsOnly || base;
  }

  setMute(userJid, groupJid, mutedBy, durationMs, reason = "", userName = "") {
    const userKey = MuteStore.getUserKey(userJid);
    const now = Date.now();
    const expiresAt = now + durationMs;

    const stmt = this.db.prepare(`
      INSERT INTO mutes (user_key, user_jid, user_name, group_jid, muted_by, reason, expires_at, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_key, group_jid) DO UPDATE SET
        user_jid = excluded.user_jid,
        user_name = excluded.user_name,
        muted_by = excluded.muted_by,
        reason = excluded.reason,
        expires_at = excluded.expires_at,
        timestamp = excluded.timestamp
    `);

    stmt.run(userKey, userJid, userName, groupJid, mutedBy, reason, expiresAt, now);
    return { expiresAt, userKey };
  }

  getMute(userJid, groupJid) {
    const userKey = MuteStore.getUserKey(userJid);

    const stmt = this.db.prepare(`
      SELECT user_key, user_jid, user_name, group_jid, muted_by, reason, expires_at, timestamp
      FROM mutes
      WHERE user_key = ? AND group_jid = ?
      LIMIT 1
    `);

    const row = stmt.get(userKey, groupJid);
    if (!row) return null;

    if (row.expires_at <= Date.now()) {
      this.clearMute(userJid, groupJid);
      return null;
    }

    return row;
  }

  isMuted(userJid, groupJid) {
    const mute = this.getMute(userJid, groupJid);
    if (!mute) {
      return {
        muted: false,
        remainingMs: 0,
        expiresAt: null,
      };
    }

    const remainingMs = Math.max(0, mute.expires_at - Date.now());
    return {
      muted: remainingMs > 0,
      remainingMs,
      expiresAt: mute.expires_at,
      reason: mute.reason || "",
    };
  }

  clearMute(userJid, groupJid) {
    const userKey = MuteStore.getUserKey(userJid);
    const stmt = this.db.prepare(`
      DELETE FROM mutes
      WHERE user_key = ? AND group_jid = ?
    `);

    const result = stmt.run(userKey, groupJid);
    return result.changes || 0;
  }

  getGroupMutes(groupJid) {
    const now = Date.now();

    // Remove expired rows first so list output is always current.
    this.db
      .prepare(
        `
      DELETE FROM mutes
      WHERE group_jid = ? AND expires_at <= ?
    `,
      )
      .run(groupJid, now);

    const stmt = this.db.prepare(`
      SELECT user_key, user_jid, user_name, group_jid, muted_by, reason, expires_at, timestamp
      FROM mutes
      WHERE group_jid = ? AND expires_at > ?
      ORDER BY expires_at ASC
    `);

    return stmt.all(groupJid, now);
  }
}

module.exports = MuteStore;
