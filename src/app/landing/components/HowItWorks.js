"use client";

export default function HowItWorks() {
  return (
    <section className="py-24 border-y border-border bg-bg-alt" id="how-it-works">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-text-main">
            How NovaRoute Works
          </h2>
          <p className="text-text-muted max-w-xl text-lg">
            Data flows seamlessly from your application through our intelligent routing layer to the best provider for the job.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connection line */}
          <div
            className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-linear-to-r from-transparent via-[color:var(--cyan)] to-transparent -z-10"
            aria-hidden="true"
          />

          {/* Step 1 */}
          <div className="flex flex-col gap-6 relative group">
            <div className="w-24 h-24 rounded-brand-lg bg-surface border border-border flex items-center justify-center group-hover:border-border-strong transition-colors z-10 mx-auto md:mx-0">
              <span className="material-symbols-outlined text-4xl text-text-muted" aria-hidden="true">
                terminal
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2 text-text-main">1. CLI &amp; SDKs</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Your requests start from your favorite tools or our unified SDK. Just change the base URL.
              </p>
            </div>
          </div>

          {/* Step 2 — the focal step */}
          <div className="flex flex-col gap-6 relative group md:items-center md:text-center">
            <div className="w-24 h-24 rounded-brand-lg bg-surface border-2 border-[color-mix(in_srgb,var(--cyan)_70%,transparent)] flex items-center justify-center shadow-[var(--shadow-accent)] z-10 mx-auto overflow-hidden p-2">
              <img src="/logo-mark-mono.svg" alt="" aria-hidden="true" className="size-14 object-contain" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2 text-[color:var(--on-pill)]">2. NovaRoute Hub</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Our engine analyzes the prompt, checks provider health, and routes for lowest latency or cost.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col gap-6 relative group md:items-end md:text-right">
            <div className="w-24 h-24 rounded-brand-lg bg-surface border border-border flex items-center justify-center group-hover:border-border-strong transition-colors z-10 mx-auto md:mx-0">
              <div className="grid grid-cols-2 gap-2" aria-hidden="true">
                <div className="w-6 h-6 rounded bg-surface-3" />
                <div className="w-6 h-6 rounded bg-surface-3" />
                <div className="w-6 h-6 rounded bg-surface-3" />
                <div className="w-6 h-6 rounded bg-surface-3" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2 text-text-main">3. AI Providers</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                The request is fulfilled by OpenAI, Anthropic, Gemini, or others instantly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
