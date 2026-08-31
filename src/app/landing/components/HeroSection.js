"use client";

import { useRouter } from "next/navigation";
import { APP_CONFIG } from "@/shared/constants/config";

export default function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative pt-32 pb-20 px-6 min-h-[90vh] flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-full blur-[120px] pointer-events-none bg-[color-mix(in_srgb,var(--cyan)_10%,transparent)]"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-4xl w-full text-center flex flex-col items-center gap-8">
        {/* Version badge, from package.json rather than a frozen literal. */}
        <div
          dir="ltr"
          className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--cyan)_25%,transparent)] bg-[color-mix(in_srgb,var(--cyan)_6%,transparent)] px-3 py-1 text-xs font-medium text-primary"
        >
          <span className="flex h-2 w-2 rounded-full bg-[color:var(--cyan)]" aria-hidden="true" />
          <span dir="ltr">{APP_CONFIG.versionLabel}</span> is now live
        </div>

        <h1 className="text-5xl md:text-7xl font-black leading-[1.1] tracking-tight text-text-main">
          One Endpoint for <br />
          <span className="text-nova-gradient">All AI Providers</span>
        </h1>

        <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto">
          AI endpoint proxy with web dashboard, a JavaScript port of CLIProxyAPI. Works seamlessly with Claude Code, OpenAI Codex, Cline, RooCode, and other CLI tools.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 w-full">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="h-12 px-8 rounded-brand bg-[image:var(--grad)] text-[color:var(--on-accent)] text-base font-bold shadow-[var(--shadow-accent)] transition-[filter,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:brightness-[1.06] active:scale-[0.97] flex items-center gap-2"
          >
            <span className="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
            Get Started
          </button>
          {/* Was "View on GitHub" pointing at the upstream author's repo. */}
          <a
            href="#how-it-works"
            className="h-12 px-8 rounded-brand border border-border bg-surface hover:bg-surface-2 text-text-main text-base font-bold transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              menu_book
            </span>
            How it Works
          </a>
        </div>
      </div>
    </section>
  );
}
