const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

class WarningStore {
  constructor(dbPath = "./database/warnings.db") {
    // Ensure database directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    this.initTables();
  }

  initTables() {
    // Create warnings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_jid TEXT NOT NULL,
        group_jid TEXT NOT NULL,
        reason TEXT NOT NULL,
        warned_by TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_user_group ON warnings(user_jid, group_jid);
      CREATE INDEX IF NOT EXISTS idx_group ON warnings(group_jid);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON warnings(timestamp);
    `);

    console.log("✅ SQLite warning store initialized");
  }

  /**
   * Add a warning to a user
   * @param {string} userJid - User's JID
   * @param {string} groupJid - Group JID
   * @param {string} reason - Warning reason
   * @param {string} warnedBy - Admin who issued warning
   * @returns {number} - Total warnings for this user in this group
   */
  addWarning(userJid, groupJid, reason, warnedBy) {
    const stmt = this.db.prepare(`
      INSERT INTO warnings (user_jid, group_jid, reason, warned_by, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(userJid, groupJid, reason, warnedBy, Date.now());
      return this.getWarningCount(userJid, groupJid);
    } catch (error) {
      console.error("Error adding warning:", error);
      return 0;
    }
  }

  /**
   * Get warning count for a user in a specific group
   * @param {string} userJid - User's JID
   * @param {string} groupJid - Group JID
   * @returns {number} - Number of warnings
   */
  getWarningCount(userJid, groupJid) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM warnings
      WHERE user_jid = ? AND group_jid = ?
    `);

    try {
      const result = stmt.get(userJid, groupJid);
      return result?.count || 0;
    } catch (error) {
      console.error("Error getting warning count:", error);
      return 0;
    }
  }

  /**
   * Get all warnings for a user in a specific group
   * @param {string} userJid - User's JID
   * @param {string} groupJid - Group JID
   * @returns {Array} - List of warnings
   */
  getWarnings(userJid, groupJid) {
    const stmt = this.db.prepare(`
      SELECT reason, warned_by, timestamp, created_at
      FROM warnings
      WHERE user_jid = ? AND group_jid = ?
      ORDER BY timestamp DESC
    `);

    try {
      return stmt.all(userJid, groupJid);
    } catch (error) {
      console.error("Error getting warnings:", error);
      return [];
    }
  }

  /**
   * Clear all warnings for a user in a specific group
   * @param {string} userJid - User's JID
   * @param {string} groupJid - Group JID
   */
  clearWarnings(userJid, groupJid) {
    const stmt = this.db.prepare(`
      DELETE FROM warnings
      WHERE user_jid = ? AND group_jid = ?
    `);

    try {
      stmt.run(userJid, groupJid);
      console.log(`🧹 Cleared warnings for ${userJid} in ${groupJid}`);
    } catch (error) {
      console.error("Error clearing warnings:", error);
    }
  }

  /**
   * Get all users with warnings in a group
   * @param {string} groupJid - Group JID
   * @returns {Array} - List of users with warning counts
   */
  getGroupWarnings(groupJid) {
    const stmt = this.db.prepare(`
      SELECT user_jid, COUNT(*) as warning_count
      FROM warnings
      WHERE group_jid = ?
      GROUP BY user_jid
      ORDER BY warning_count DESC
    `);

    try {
      return stmt.all(groupJid);
    } catch (error) {
      console.error("Error getting group warnings:", error);
      return [];
    }
  }

  /**
   * Clean old warnings (older than 30 days)
   */
  cleanOldWarnings() {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const stmt = this.db.prepare(`
      DELETE FROM warnings
      WHERE timestamp < ?
    `);

    try {
      const result = stmt.run(thirtyDaysAgo);
      if (result.changes > 0) {
        console.log(`🧹 Cleaned ${result.changes} old warnings`);
      }
    } catch (error) {
      console.error("Error cleaning old warnings:", error);
    }
  }

  /**
   * Get database statistics
   */
  getStats() {
    try {
      const totalWarnings = this.db
        .prepare("SELECT COUNT(*) as count FROM warnings")
        .get().count;
      const totalUsers = this.db
        .prepare("SELECT COUNT(DISTINCT user_jid) as count FROM warnings")
        .get().count;
      const totalGroups = this.db
        .prepare("SELECT COUNT(DISTINCT group_jid) as count FROM warnings")
        .get().count;

      return {
        totalWarnings,
        totalUsers,
        totalGroups,
      };
    } catch (error) {
      console.error("Error getting stats:", error);
      return { totalWarnings: 0, totalUsers: 0, totalGroups: 0 };
    }
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = WarningStore;
