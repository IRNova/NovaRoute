/**
 * Gamification System — badges, leaderboard, XP, streaks, invites
 * Modeled after OmniRoute's gamification module
 */

// ─── Badge System ──────────────────────────────────────────────────────────

const BADGE_DEFINITIONS = [
  // Onboarding
  { id: 'first_login', name: 'First Login', icon: '🔑', description: 'Logged in for the first time', xp: 10, category: 'onboarding' },
  { id: 'profile_complete', name: 'Profile Complete', icon: '👤', description: 'Completed your profile', xp: 25, category: 'onboarding' },
  { id: 'first_provider', name: 'First Provider', icon: '🔌', description: 'Connected your first provider', xp: 50, category: 'onboarding' },

  // Usage
  { id: 'first_chat', name: 'First Chat', icon: '💬', description: 'Sent your first chat message', xp: 10, category: 'usage' },
  { id: 'chat_10', name: 'Chatter', icon: '🗣️', description: 'Sent 10 chat messages', xp: 50, category: 'usage' },
  { id: 'chat_100', name: 'Conversationalist', icon: '🎙️', description: 'Sent 100 chat messages', xp: 200, category: 'usage' },
  { id: 'chat_1000', name: 'Chat Master', icon: '👑', description: 'Sent 1000 chat messages', xp: 1000, category: 'usage' },
  { id: 'tokens_1k', name: 'Token User', icon: '🪙', description: 'Used 1K tokens', xp: 25, category: 'usage' },
  { id: 'tokens_100k', name: 'Token Spender', icon: '💰', description: 'Used 100K tokens', xp: 200, category: 'usage' },
  { id: 'tokens_1m', name: 'Token Millionaire', icon: '💎', description: 'Used 1M tokens', xp: 1000, category: 'usage' },

  // Providers
  { id: 'provider_5', name: 'Multi-Provider', icon: '🌐', description: 'Connected 5 providers', xp: 100, category: 'providers' },
  { id: 'provider_10', name: 'Provider Collector', icon: '🏦', description: 'Connected 10 providers', xp: 300, category: 'providers' },
  { id: 'provider_free', name: 'Free Rider', icon: '🆓', description: 'Used 3 free providers', xp: 150, category: 'providers' },

  // AI Features
  { id: 'first_tool', name: 'Tool User', icon: '🔧', description: 'Used an MCP tool', xp: 30, category: 'ai' },
  { id: 'smart_route', name: 'Smart Router', icon: '🧭', description: 'Used the smart router', xp: 50, category: 'ai' },
  { id: 'combo_user', name: 'Combo Master', icon: '🎭', description: 'Used combo routing', xp: 75, category: 'ai' },

  // Security
  { id: 'guardrail_user', name: 'Safety First', icon: '🛡️', description: 'Triggered a guardrail check', xp: 20, category: 'security' },
  { id: 'secure_pro', name: 'Security Pro', icon: '🔒', description: 'Enabled all guardrails', xp: 100, category: 'security' },

  // Social
  { id: 'first_invite', name: 'Welcomer', icon: '🤝', description: 'Invited your first user', xp: 50, category: 'social' },
  { id: 'invite_5', name: 'Ambassador', icon: '🌍', description: 'Invited 5 users', xp: 250, category: 'social' },
  { id: 'share_first', name: 'Sharer', icon: '📤', description: 'Shared your first result', xp: 15, category: 'social' },

  // Streaks
  { id: 'streak_3', name: 'On Fire', icon: '🔥', description: '3-day login streak', xp: 30, category: 'streaks' },
  { id: 'streak_7', name: 'Week Warrior', icon: '⚡', description: '7-day login streak', xp: 100, category: 'streaks' },
  { id: 'streak_30', name: 'Monthly Master', icon: '🏆', description: '30-day login streak', xp: 500, category: 'streaks' },
  { id: 'streak_100', name: 'Century Club', icon: '💯', description: '100-day login streak', xp: 2000, category: 'streaks' },

  // Achievements
  { id: 'speed_demon', name: 'Speed Demon', icon: '⚡', description: 'Completed a request in under 100ms', xp: 75, category: 'achievements' },
  { id: 'cost_saver', name: 'Cost Saver', icon: '💰', description: 'Saved 50%+ on token costs', xp: 100, category: 'achievements' },
  { id: 'bug_hunter', name: 'Bug Hunter', icon: '🐛', description: 'Reported a bug', xp: 150, category: 'achievements' },
  { id: 'power_user', name: 'Power User', icon: '⚡', description: 'Used all major features', xp: 500, category: 'achievements' },
];

export class BadgeSystem {
  constructor(storage = null) {
    this.storage = storage ?? new InMemoryBadgeStorage();
    this.definitions = new Map(BADGE_DEFINITIONS.map(b => [b.id, b]));
  }

  /**
   * Award a badge to a user
   */
  async awardBadge(userId, badgeId) {
    const badge = this.definitions.get(badgeId);
    if (!badge) return null;

    const existing = await this.storage.getUserBadge(userId, badgeId);
    if (existing) return null; // Already awarded

    const awarded = {
      ...badge,
      userId,
      awardedAt: new Date().toISOString(),
    };

    await this.storage.saveUserBadge(userId, awarded);
    return awarded;
  }

  /**
   * Check and award badges based on user stats
   */
  async checkAndAward(userId, stats) {
    const newBadges = [];

    // Check usage badges
    if (stats.totalMessages >= 1) await this._try(userId, 'first_chat', newBadges);
    if (stats.totalMessages >= 10) await this._try(userId, 'chat_10', newBadges);
    if (stats.totalMessages >= 100) await this._try(userId, 'chat_100', newBadges);
    if (stats.totalMessages >= 1000) await this._try(userId, 'chat_1000', newBadges);

    // Token badges
    if (stats.totalTokens >= 1000) await this._try(userId, 'tokens_1k', newBadges);
    if (stats.totalTokens >= 100_000) await this._try(userId, 'tokens_100k', newBadges);
    if (stats.totalTokens >= 1_000_000) await this._try(userId, 'tokens_1m', newBadges);

    // Provider badges
    if (stats.connectedProviders >= 5) await this._try(userId, 'provider_5', newBadges);
    if (stats.connectedProviders >= 10) await this._try(userId, 'provider_10', newBadges);

    // Streak badges
    if (stats.currentStreak >= 3) await this._try(userId, 'streak_3', newBadges);
    if (stats.currentStreak >= 7) await this._try(userId, 'streak_7', newBadges);
    if (stats.currentStreak >= 30) await this._try(userId, 'streak_30', newBadges);
    if (stats.currentStreak >= 100) await this._try(userId, 'streak_100', newBadges);

    return newBadges;
  }

  async _try(userId, badgeId, newBadges) {
    const badge = await this.awardBadge(userId, badgeId);
    if (badge) newBadges.push(badge);
  }

  /**
   * Get user's badges
   */
  async getUserBadges(userId) {
    return this.storage.getUserBadges(userId);
  }

  /**
   * Get all badge definitions
   */
  getAllDefinitions() {
    return BADGE_DEFINITIONS;
  }
}

// ─── XP System ─────────────────────────────────────────────────────────────

export class XPSystem {
  constructor(storage = null) {
    this.storage = storage ?? new InMemoryBadgeStorage();
  }

  /**
   * Award XP to a user
   */
  async addXP(userId, amount, source = 'unknown') {
    const current = await this.storage.getUserXP(userId);
    const newTotal = current + amount;
    await this.storage.setUserXP(userId, newTotal);
    return { previous: current, added: amount, total: newTotal, source };
  }

  /**
   * Get user XP
   */
  async getXP(userId) {
    return this.storage.getUserXP(userId);
  }

  /**
   * Calculate level from XP
   */
  static calculateLevel(xp) {
    // XP thresholds per level (exponential growth)
    const levelThresholds = [
      0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500,
      5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000,
    ];

    let level = 1;
    for (let i = 1; i < levelThresholds.length; i++) {
      if (xp >= levelThresholds[i]) level = i + 1;
      else break;
    }

    const currentThreshold = levelThresholds[level - 1] ?? 0;
    const nextThreshold = levelThresholds[level] ?? levelThresholds[levelThresholds.length - 1] + 2000;
    const progress = (xp - currentThreshold) / (nextThreshold - currentThreshold);

    return { level, xp, progress: Math.min(1, progress), nextLevelXP: nextThreshold };
  }
}

// ─── Streak System ─────────────────────────────────────────────────────────

export class StreakSystem {
  constructor(storage = null) {
    this.storage = storage ?? new InMemoryBadgeStorage();
  }

  /**
   * Record a daily activity
   */
  async recordActivity(userId, date = null) {
    const today = date ?? new Date().toISOString().split('T')[0];
    const streakData = await this.storage.getUserStreak(userId);

    // Check if already recorded today
    if (streakData.lastDate === today) {
      return streakData;
    }

    // Check if streak continues
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newStreak = 1;

    if (streakData.lastDate === yesterday) {
      newStreak = streakData.current + 1;
    }

    // Check if streak was broken
    if (streakData.lastDate !== yesterday && streakData.lastDate !== today) {
      newStreak = 1;
    }

    const updated = {
      current: newStreak,
      longest: Math.max(newStreak, streakData.longest),
      lastDate: today,
      totalDays: streakData.totalDays + 1,
    };

    await this.storage.setUserStreak(userId, updated);
    return updated;
  }

  /**
   * Get user streak data
   */
  async getStreak(userId) {
    return this.storage.getUserStreak(userId);
  }
}

// ─── Leaderboard ───────────────────────────────────────────────────────────

export class Leaderboard {
  constructor(storage = null) {
    this.storage = storage ?? new InMemoryBadgeStorage();
  }

  /**
   * Get leaderboard sorted by XP
   */
  async getLeaderboard(limit = 10, category = 'xp') {
    return this.storage.getLeaderboard(limit, category);
  }

  /**
   * Get user's rank
   */
  async getUserRank(userId, category = 'xp') {
    return this.storage.getUserRank(userId, category);
  }
}

// ─── In-Memory Storage (default) ───────────────────────────────────────────

class InMemoryBadgeStorage {
  constructor() {
    this.badges = new Map(); // userId → badge[]
    this.xp = new Map();    // userId → number
    this.streaks = new Map(); // userId → streak data
  }

  async getUserBadge(userId, badgeId) {
    const userBadges = this.badges.get(userId) ?? [];
    return userBadges.find(b => b.id === badgeId);
  }

  async getUserBadges(userId) {
    return this.badges.get(userId) ?? [];
  }

  async saveUserBadge(userId, badge) {
    const existing = this.badges.get(userId) ?? [];
    existing.push(badge);
    this.badges.set(userId, existing);
  }

  async getUserXP(userId) {
    return this.xp.get(userId) ?? 0;
  }

  async setUserXP(userId, xp) {
    this.xp.set(userId, xp);
  }

  async getUserStreak(userId) {
    return this.streaks.get(userId) ?? { current: 0, longest: 0, lastDate: null, totalDays: 0 };
  }

  async setUserStreak(userId, streak) {
    this.streaks.set(userId, streak);
  }

  async getLeaderboard(limit = 10, category = 'xp') {
    const entries = [];
    for (const [userId, xp] of this.xp.entries()) {
      entries.push({ userId, score: xp });
    }
    entries.sort((a, b) => b.score - a.score);
    return entries.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  async getUserRank(userId, category = 'xp') {
    const leaderboard = await this.getLeaderboard(1000, category);
    const entry = leaderboard.find(e => e.userId === userId);
    return entry?.rank ?? null;
  }
}

// ─── Main Gamification Manager ─────────────────────────────────────────────

export class GamificationManager {
  constructor(storage = null) {
    this.badges = new BadgeSystem(storage);
    this.xp = new XPSystem(storage);
    this.streaks = new StreakSystem(storage);
    this.leaderboard = new Leaderboard(storage);
  }

  /**
   * Process an event and update gamification state
   */
  async processEvent(userId, eventType, eventData = {}) {
    const results = { badges: [], xp: null, streak: null };

    // Award XP based on event
    const xpMap = {
      'chat_message': 5,
      'tool_use': 10,
      'provider_connect': 50,
      'login': 10,
      'share': 15,
      'invite': 50,
      'bug_report': 150,
    };

    if (xpMap[eventType]) {
      results.xp = await this.xp.addXP(userId, xpMap[eventType], eventType);
    }

    // Record daily activity
    if (eventType === 'login' || eventType === 'chat_message') {
      results.streak = await this.streaks.recordActivity(userId);
    }

    // Check for badge awards
    const xpTotal = await this.xp.getXP(userId);
    const streakData = await this.streaks.getStreak(userId);
    results.badges = await this.badges.checkAndAward(userId, {
      totalMessages: eventData.totalMessages ?? 0,
      totalTokens: eventData.totalTokens ?? 0,
      connectedProviders: eventData.connectedProviders ?? 0,
      currentStreak: streakData.current,
    });

    return results;
  }

  /**
   * Get full user gamification profile
   */
  async getUserProfile(userId) {
    const badges = await this.badges.getUserBadges(userId);
    const xp = await this.xp.getXP(userId);
    const streak = await this.streaks.getStreak(userId);
    const rank = await this.leaderboard.getUserRank(userId);
    const level = XPSystem.calculateLevel(xp);

    return { badges, xp, streak, rank, level };
  }
}

export { BADGE_DEFINITIONS };
