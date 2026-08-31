"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";

const ACHIEVEMENTS = [
  { id: "first-request", name: "First Request", icon: "send", description: "Send your first API request", xp: 50 },
  { id: "hundred-requests", name: "Century", icon: "looks_one", description: "Send 100 requests", xp: 200 },
  { id: "thousand-tokens", name: "Token Hog", icon: "token", description: "Use 1,000 tokens in one session", xp: 150 },
  { id: "multi-provider", name: "Polyglot", icon: "hub", description: "Use 5 different providers", xp: 300 },
  { id: "cost-saver", name: "Cost Saver", icon: "savings", description: "Save $10 via caching", xp: 250 },
  { id: "streak-7", name: "Week Warrior", icon: "local_fire_department", description: "7-day activity streak", xp: 500 },
  { id: "combo-master", name: "Combo Master", icon: "blend", description: "Create 10 model combos", xp: 350 },
  { id: "uptime-king", name: "Uptime King", icon: "timer", description: "99.9% uptime for 30 days", xp: 1000 },
];

const DEFAULT_DATA = {
  level: 12,
  xp: 4750,
  xpToNext: 6000,
  streak: 14,
  badges: ["first-request", "hundred-requests", "thousand-tokens", "multi-provider", "cost-saver", "streak-7"],
  totalXpEarned: 12400,
  rank: "Gold",
};

export default function GamificationPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gamification")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d || DEFAULT_DATA); setLoading(false); })
      .catch(() => { setData(DEFAULT_DATA); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  const xpPercent = data.xpToNext > 0 ? Math.min(100, (data.xp / data.xpToNext) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Gamification</h1>
          <p className="text-sm text-text-muted mt-1">Track your progress, earn achievements, and climb the ranks</p>
        </div>
        <Badge variant="warning" icon="military_tech">{data.rank}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-[10px] bg-primary/10">
              <span className="material-symbols-outlined text-[24px] text-primary">leaderboard</span>
            </div>
            <p className="text-xs text-text-muted">Level</p>
          </div>
          <p className="text-3xl font-bold text-text-main">{data.level}</p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span>{data.xp.toLocaleString()} XP</span>
              <span>{data.xpToNext.toLocaleString()} XP</span>
            </div>
            <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-[10px] bg-success/10">
              <span className="material-symbols-outlined text-[24px] text-success">stars</span>
            </div>
            <p className="text-xs text-text-muted">Total XP Earned</p>
          </div>
          <p className="text-3xl font-bold text-text-main">{data.totalXpEarned.toLocaleString()}</p>
          <p className="text-xs text-text-muted mt-2">Lifetime experience points</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-[10px] bg-warning/10">
              <span className="material-symbols-outlined text-[24px] text-warning">local_fire_department</span>
            </div>
            <p className="text-xs text-text-muted">Streak</p>
          </div>
          <p className="text-3xl font-bold text-text-main">{data.streak} <span className="text-lg text-text-muted">days</span></p>
          <p className="text-xs text-text-muted mt-2">Keep it going!</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-[10px] bg-info/10">
              <span className="material-symbols-outlined text-[24px] text-info">workspace_premium</span>
            </div>
            <p className="text-xs text-text-muted">Badges Earned</p>
          </div>
          <p className="text-3xl font-bold text-text-main">{data.badges.length}<span className="text-lg text-text-muted"> / {ACHIEVEMENTS.length}</span></p>
          <p className="text-xs text-text-muted mt-2">{ACHIEVEMENTS.length - data.badges.length} remaining</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-main">Level Progress</h3>
          <span className="text-xs text-text-muted">Level {data.level} → {data.level + 1}</span>
        </div>
        <div className="h-4 bg-surface-3 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all" style={{ width: `${xpPercent}%` }} />
        </div>
        <p className="text-xs text-text-muted mt-2">{(data.xpToNext - data.xp).toLocaleString()} XP to next level</p>
      </Card>

      <div>
        <h2 className="text-lg font-bold text-text-main mb-4">Achievements</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = data.badges.includes(a.id);
            return (
              <Card key={a.id} className={`p-5 ${unlocked ? "border-success/30" : "opacity-60"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-full ${unlocked ? "bg-success/10" : "bg-surface-3"}`}>
                    <span className={`material-symbols-outlined text-[20px] ${unlocked ? "text-success" : "text-text-muted"}`}>
                      {unlocked ? "workspace_premium" : "lock"}
                    </span>
                  </div>
                  <Badge variant={unlocked ? "success" : "default"} size="sm">{unlocked ? "Unlocked" : "Locked"}</Badge>
                </div>
                <h4 className="font-semibold text-text-main text-sm">{a.name}</h4>
                <p className="text-xs text-text-muted mt-1">{a.description}</p>
                <p className="text-xs text-primary mt-2 font-medium">+{a.xp} XP</p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
