const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// In-game currency store. Tracks each user's coin balance, daily-reward
// cooldown, and provides safe bet/transfer helpers used by the gambling games
// and the Mafia rewards.
class EconomyStore {
  constructor(dbPath = "./database/economy.db") {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    // Tunables
    this.startingBalance = 1000;
    this.dailyReward = 500;
    this.dailyCooldownMs = 20 * 60 * 60 * 1000; // 20 hours

    this.initTables();
  }

  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS economy (
        user_key TEXT PRIMARY KEY,
        user_jid TEXT,
        user_name TEXT,
        balance INTEGER NOT NULL DEFAULT 0,
        last_daily INTEGER DEFAULT 0,
        total_wagered INTEGER NOT NULL DEFAULT 0,
        total_won INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_economy_balance ON economy(balance);
    `);

    console.log("✅ SQLite economy store initialized");
  }

  // Normalize a JID into a stable per-user key (phone-number portion)
  static getUserKey(userJid = "") {
    const base = String(userJid).split("@")[0].split(":")[0];
    const digitsOnly = base.replace(/[^0-9]/g, "");
    return digitsOnly || base;
  }

  // Make sure a user row exists, seeding the starting balance for new users
  ensureUser(userJid, userName = null) {
    const key = EconomyStore.getUserKey(userJid);
    const existing = this.db
      .prepare("SELECT user_key FROM economy WHERE user_key = ?")
      .get(key);

    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO economy (user_key, user_jid, user_name, balance, last_daily)
           VALUES (?, ?, ?, ?, 0)`,
        )
        .run(key, userJid, userName, this.startingBalance);
    } else if (userName) {
      this.db
        .prepare(
          "UPDATE economy SET user_name = ?, user_jid = ? WHERE user_key = ?",
        )
        .run(userName, userJid, key);
    }
    return key;
  }

  getBalance(userJid) {
    const key = this.ensureUser(userJid);
    const row = this.db
      .prepare("SELECT balance FROM economy WHERE user_key = ?")
      .get(key);
    return row ? row.balance : 0;
  }

  // Add coins (won) - also tracks lifetime winnings when `won` is true
  addBalance(userJid, amount, { won = false } = {}) {
    const key = this.ensureUser(userJid);
    const inc = Math.max(0, Math.floor(amount));
    this.db
      .prepare(
        `UPDATE economy SET balance = balance + ?,
           total_won = total_won + ?
         WHERE user_key = ?`,
      )
      .run(inc, won ? inc : 0, key);
    return this.getBalance(userJid);
  }

  // Remove coins. Returns false (no change) if the user can't afford it.
  deductBalance(userJid, amount, { wager = false } = {}) {
    const key = this.ensureUser(userJid);
    const dec = Math.max(0, Math.floor(amount));
    const row = this.db
      .prepare("SELECT balance FROM economy WHERE user_key = ?")
      .get(key);
    if (!row || row.balance < dec) return false;
    this.db
      .prepare(
        `UPDATE economy SET balance = balance - ?,
           total_wagered = total_wagered + ?
         WHERE user_key = ?`,
      )
      .run(dec, wager ? dec : 0, key);
    return true;
  }

  // Returns ms remaining before daily can be claimed, or 0 if available now
  dailyCooldownRemaining(userJid) {
    const key = this.ensureUser(userJid);
    const row = this.db
      .prepare("SELECT last_daily FROM economy WHERE user_key = ?")
      .get(key);
    const last = row?.last_daily || 0;
    const elapsed = Date.now() - last;
    return elapsed >= this.dailyCooldownMs ? 0 : this.dailyCooldownMs - elapsed;
  }

  // Claim the daily reward. Returns { ok, amount, balance, remainingMs }
  claimDaily(userJid, userName = null) {
    const key = this.ensureUser(userJid, userName);
    const remaining = this.dailyCooldownRemaining(userJid);
    if (remaining > 0) {
      return { ok: false, remainingMs: remaining, balance: this.getBalance(userJid) };
    }
    this.db
      .prepare(
        "UPDATE economy SET balance = balance + ?, last_daily = ? WHERE user_key = ?",
      )
      .run(this.dailyReward, Date.now(), key);
    return {
      ok: true,
      amount: this.dailyReward,
      balance: this.getBalance(userJid),
    };
  }

  // Transfer coins between users. Returns { ok, reason?, balance }
  transfer(fromJid, toJid, amount, toName = null) {
    const amt = Math.floor(amount);
    if (!amt || amt <= 0) {
      return { ok: false, reason: "invalid_amount" };
    }
    if (EconomyStore.getUserKey(fromJid) === EconomyStore.getUserKey(toJid)) {
      return { ok: false, reason: "self" };
    }
    this.ensureUser(toJid, toName);
    const transferTxn = this.db.transaction(() => {
      const removed = this.deductBalance(fromJid, amt);
      if (!removed) return false;
      this.addBalance(toJid, amt);
      return true;
    });
    const ok = transferTxn();
    return {
      ok,
      reason: ok ? undefined : "insufficient",
      balance: this.getBalance(fromJid),
    };
  }

  // Top balances for the leaderboard
  getLeaderboard(limit = 10) {
    return this.db
      .prepare(
        "SELECT user_key, user_jid, user_name, balance FROM economy ORDER BY balance DESC LIMIT ?",
      )
      .all(limit);
  }

  close() {
    this.db.close();
  }
}

module.exports = EconomyStore;
