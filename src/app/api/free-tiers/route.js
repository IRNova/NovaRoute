import { NextResponse } from "next/server";

// Reference data on well-known free LLM tiers (community-maintained; verify
// limits with each provider before relying on them).
const TIERS = [
  { provider: "Google AI Studio", color: "#4285F4", freeModels: ["gemini-2.0-flash", "gemini-1.5-flash"], dailyLimit: "1500 req/day (flash)", monthlyLimit: "—", status: "generous", signupUrl: "https://aistudio.google.com" },
  { provider: "OpenRouter", color: "#8B5CF6", freeModels: [":free tagged models (40+)",], dailyLimit: "50 req/day (200 with $10 credit)", monthlyLimit: "—", status: "good", signupUrl: "https://openrouter.ai" },
  { provider: "GitHub Models", color: "#24292f", freeModels: ["gpt-4o-mini", "llama-3.x", "phi-3"], dailyLimit: "rate-limited per tier", monthlyLimit: "free during preview", status: "good", signupUrl: "https://github.com/marketplace/models" },
  { provider: "Groq", color: "#F55036", freeModels: ["llama-3.x", "mixtral", "gemma2"], dailyLimit: "~14k req/day (model-dependent)", monthlyLimit: "—", status: "fast", signupUrl: "https://console.groq.com" },
  { provider: "Mistral (La Plateforme)", color: "#FF7000", freeModels: ["mistral-small", "open-mistral-nemo"], dailyLimit: "1 req/sec tier", monthlyLimit: "free tier w/ data training opt-in", status: "ok", signupUrl: "https://console.mistral.ai" },
  { provider: "Cohere", color: "#39594D", freeModels: ["command-r", "command-r-plus"], dailyLimit: "trial keys, 1000 calls/month", monthlyLimit: "1000 calls", status: "trial", signupUrl: "https://dashboard.cohere.com" },
  { provider: "Cerebras", color: "#F05537", freeModels: ["llama-3.1-70b", "llama3.1-8b"], dailyLimit: "tokens/day quota", monthlyLimit: "1M tokens/day (approx)", status: "very fast", signupUrl: "https://cloud.cerebras.ai" },
  { provider: "Hugging Face", color: "#FFD21E", freeModels: ["inference API serverless (small models)"], dailyLimit: "hourly request caps", monthlyLimit: "free credits/month", status: "ok", signupUrl: "https://huggingface.co/inference-api" },
];

export async function GET() {
  return NextResponse.json({ tiers: TIERS });
}
