import { NextResponse } from "next/server";

// Reference ranking of popular FREE model families by practical quality,
// rate-limit friendliness and speed (community consensus; verify live).
const PROVIDERS = [
  { rank: 1, provider: "Gemini Flash (AI Studio)", models: 4, rateLimit: "1500/day flash", qualityScore: 88, color: "#4285F4" },
  { rank: 2, provider: "Groq Llama 3.x 70B", models: 5, rateLimit: "~30 req/min", qualityScore: 84, color: "#F55036" },
  { rank: 3, provider: "OpenRouter :free pool", models: 40, rateLimit: "50/day base", qualityScore: 78, color: "#8B5CF6" },
  { rank: 4, provider: "Cerebras Llama 70B", models: 2, rateLimit: "token quota/day", qualityScore: 82, color: "#F05537" },
  { rank: 5, provider: "GitHub Models GPT-4o-mini", models: 6, rateLimit: "tier-based", qualityScore: 80, color: "#24292f" },
  { rank: 6, provider: "Mistral Nemo", models: 3, rateLimit: "1 req/s", qualityScore: 72, color: "#FF7000" },
  { rank: 7, provider: "HF Serverless Small", models: 15, rateLimit: "hourly caps", qualityScore: 65, color: "#FFD21E" },
  { rank: 8, provider: "Cohere Command-R", models: 2, rateLimit: "1000/month", qualityScore: 74, color: "#39594D" },
];

export async function GET() {
  return NextResponse.json({ providers: PROVIDERS });
}
