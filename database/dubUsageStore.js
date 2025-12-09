const fs = require("fs");
const path = require("path");

class DubUsageStore {
  constructor() {
    this.usageFile = path.join(__dirname, "dub-usage.json");
    this.maxDubsPerDay = 5;
    this.usageData = this.loadUsageData();
  }

  /**
   * Load usage data from file
   */
  loadUsageData() {
    try {
      if (fs.existsSync(this.usageFile)) {
        const data = fs.readFileSync(this.usageFile, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading dub usage data:", error);
    }
    return {};
  }

  /**
   * Save usage data to file
   */
  saveUsageData() {
    try {
      fs.writeFileSync(
        this.usageFile,
        JSON.stringify(this.usageData, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("Error saving dub usage data:", error);
    }
  }

  /**
   * Get current date string (YYYY-MM-DD)
   */
  getCurrentDate() {
    const now = new Date();
    return now.toISOString().split("T")[0];
  }

  /**
   * Check if user can dub (has remaining quota)
   * @param {string} jid - User's JID
   * @returns {{allowed: boolean, remaining: number, used: number}}
   */
  canUserDub(jid) {
    const today = this.getCurrentDate();
    const userUsage = this.usageData[jid];

    // If no usage record or different date, user has full quota
    if (!userUsage || userUsage.date !== today) {
      return {
        allowed: true,
        remaining: this.maxDubsPerDay,
        used: 0,
      };
    }

    // Check if user has exceeded limit
    const used = userUsage.count || 0;
    const remaining = Math.max(0, this.maxDubsPerDay - used);

    return {
      allowed: remaining > 0,
      remaining: remaining,
      used: used,
    };
  }

  /**
   * Record a dub usage for a user
   * @param {string} jid - User's JID
   * @returns {{success: boolean, remaining: number}}
   */
  recordDubUsage(jid) {
    const today = this.getCurrentDate();
    const userUsage = this.usageData[jid];

    // Initialize or reset if new day
    if (!userUsage || userUsage.date !== today) {
      this.usageData[jid] = {
        date: today,
        count: 1,
      };
    } else {
      // Increment count
      this.usageData[jid].count += 1;
    }

    // Save to file
    this.saveUsageData();

    const remaining = Math.max(
      0,
      this.maxDubsPerDay - this.usageData[jid].count
    );

    return {
      success: true,
      remaining: remaining,
    };
  }

  /**
   * Get remaining dubs for a user
   * @param {string} jid - User's JID
   * @returns {number}
   */
  getRemainingDubs(jid) {
    const check = this.canUserDub(jid);
    return check.remaining;
  }

  /**
   * Get usage statistics for a user
   * @param {string} jid - User's JID
   * @returns {{date: string, used: number, remaining: number, limit: number}}
   */
  getUserStats(jid) {
    const today = this.getCurrentDate();
    const userUsage = this.usageData[jid];

    if (!userUsage || userUsage.date !== today) {
      return {
        date: today,
        used: 0,
        remaining: this.maxDubsPerDay,
        limit: this.maxDubsPerDay,
      };
    }

    return {
      date: today,
      used: userUsage.count || 0,
      remaining: Math.max(0, this.maxDubsPerDay - (userUsage.count || 0)),
      limit: this.maxDubsPerDay,
    };
  }

  /**
   * Reset usage for a specific user (admin function)
   * @param {string} jid - User's JID
   */
  resetUserUsage(jid) {
    delete this.usageData[jid];
    this.saveUsageData();
  }

  /**
   * Clean up old usage data (older than 7 days)
   */
  cleanupOldData() {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split("T")[0];

    let cleaned = 0;
    for (const jid in this.usageData) {
      if (this.usageData[jid].date < cutoffDate) {
        delete this.usageData[jid];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveUsageData();
      console.log(`🧹 Cleaned up ${cleaned} old dub usage records`);
    }
  }
}

module.exports = new DubUsageStore();
