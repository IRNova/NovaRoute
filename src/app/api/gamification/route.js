import { NextResponse } from 'next/server';
import { GamificationManager, BadgeSystem, XPSystem } from '@/lib/gamification/index.js';

const gamification = new GamificationManager();

// GET — get user profile, leaderboard, or badge definitions
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') ?? 'profile';
    const userId = url.searchParams.get('userId') ?? 'default';

    switch (action) {
      case 'profile':
        const profile = await gamification.getUserProfile(userId);
        return NextResponse.json(profile);

      case 'badges':
        const badges = await gamification.badges.getUserBadges(userId);
        return NextResponse.json({ badges });

      case 'all-badges':
        const allBadges = gamification.badges.getAllDefinitions();
        return NextResponse.json({ badges: allBadges, total: allBadges.length });

      case 'leaderboard':
        const limit = parseInt(url.searchParams.get('limit') ?? '10');
        const leaderboard = await gamification.leaderboard.getLeaderboard(limit);
        return NextResponse.json({ leaderboard });

      case 'rank':
        const rank = await gamification.leaderboard.getUserRank(userId);
        return NextResponse.json({ userId, rank });

      case 'level':
        const xp = await gamification.xp.getXP(userId);
        const level = XPSystem.calculateLevel(xp);
        return NextResponse.json(level);

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — process events, award badges, add XP
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, userId = 'default', eventType, eventData } = body;

    switch (action) {
      case 'event':
        const result = await gamification.processEvent(userId, eventType, eventData);
        return NextResponse.json(result);

      case 'add-xp':
        const xpResult = await gamification.xp.addXP(userId, body.amount, body.source);
        return NextResponse.json(xpResult);

      case 'award-badge':
        const badge = await gamification.badges.awardBadge(userId, body.badgeId);
        return NextResponse.json({ awarded: !!badge, badge });

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
