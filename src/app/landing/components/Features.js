"use client";

// The eight cards used to carry eight unrelated accent colours (blue, cyan,
// rose, purple, amber, sky, emerald, fuchsia), which read as decoration rather
// than meaning and pulled the page off the Nova palette. They now cycle the
// three stops of the signature gradient, so the grid still has rhythm but every
// hue belongs to the brand. --accent-1/2/3 are the theme-aware trio: each is
// picked to clear 3:1 as a glyph on its own tint in its own theme, which the
// raw gradient stops do not (the #818cf8 midpoint is 2.6:1 on light).
const TONES = ["accent-1", "accent-2", "accent-3"];

const FEATURES = [
  { icon: "link", title: "Unified Endpoint", desc: "Access all providers via a single standard API URL." },
  { icon: "bolt", title: "Easy Setup", desc: "Get up and running in minutes with npx command." },
  { icon: "shield_with_heart", title: "Model Fallback", desc: "Automatically switch providers on failure or high latency." },
  { icon: "monitoring", title: "Usage Tracking", desc: "Detailed analytics and cost monitoring across all models." },
  { icon: "key", title: "OAuth & API Keys", desc: "Securely manage credentials in one vault." },
  { icon: "cloud_sync", title: "Cloud Sync", desc: "Sync your configurations across devices instantly." },
  { icon: "terminal", title: "CLI Support", desc: "Works with Claude Code, Codex, Cline, Cursor, and more." },
  { icon: "dashboard", title: "Dashboard", desc: "Visual dashboard for real-time traffic analysis." },
];

export default function Features() {
  return (
    <section className="py-24 px-6" id="features">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-text-main">
            Powerful Features
          </h2>
          <p className="text-text-muted max-w-xl text-lg">
            Everything you need to manage your AI infrastructure in one place, built for scale.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature, i) => {
            const tone = `var(--${TONES[i % TONES.length]})`;
            return (
              <div
                key={feature.title}
                className="group p-6 rounded-brand-lg bg-surface border border-border transition-[border-color,background-color,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:bg-surface-2"
                style={{ "--tone": tone }}
              >
                <div className="w-10 h-10 rounded-brand flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 bg-[color-mix(in_srgb,var(--tone)_14%,transparent)] text-[color:var(--tone)]">
                  <span className="material-symbols-outlined" aria-hidden="true">{feature.icon}</span>
                </div>
                <h3 className="text-lg font-bold mb-2 text-text-main">{feature.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
