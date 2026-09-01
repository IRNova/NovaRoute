import { redirect } from "next/navigation";

// Badges, XP, streaks and a leaderboard. Not something an operator of an AI
// gateway needs, and it had no inbound link from anywhere in the app.
export default function GamificationRedirect() {
  redirect("/dashboard");
}
