"use client";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

const STEPS = [
  { n: 1, title: "Install NovaRoute", desc: "Build once from source, then start the server" },
  { n: 2, title: "Open Dashboard", desc: "Configure providers and API keys via web interface" },
  { n: 3, title: "Route Requests", desc: "Point your CLI tools to http://localhost:20128" },
];

export default function GetStarted() {
  const { copied, copy } = useCopyToClipboard();

  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Left: Steps */}
          <div className="flex-1">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight text-text-main">
              Get Started in 30 Seconds
            </h2>
            <p className="text-text-muted text-lg mb-8">
              Install NovaRoute, configure your providers via web dashboard, and start routing AI requests.
            </p>

            <ol className="flex flex-col gap-6">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-4">
                  <span
                    className="flex-none w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--cyan)_18%,transparent)] text-[color:var(--on-pill)] flex items-center justify-center font-bold text-sm"
                    aria-hidden="true"
                  >
                    {s.n}
                  </span>
                  <div>
                    <h3 className="font-bold text-lg text-text-main">{s.title}</h3>
                    <p className="text-sm text-text-muted mt-1">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Right: terminal. Deliberately dark in BOTH themes — --code-bg is a
              constant in the Nova canon, because a terminal reads as a terminal. */}
          <div className="flex-1 w-full">
            <div className="rounded-brand-lg overflow-hidden bg-[color:var(--code-bg)] border border-border shadow-[var(--shadow-pop)]">
              <div className="flex items-center gap-2 px-4 py-3 bg-black/30 border-b border-white/10">
                <span className="w-3 h-3 rounded-full bg-[#FF5F56]" aria-hidden="true" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" aria-hidden="true" />
                <span className="w-3 h-3 rounded-full bg-[#27C93F]" aria-hidden="true" />
                <span className="ml-2 text-xs text-white/50 font-mono">terminal</span>
              </div>

              <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto" dir="ltr">
                {/* Was `npx novaroute`, which installs the upstream author's
                    npm package rather than this build. Until IRNova publishes
                    its own package, the honest start command is a local run. */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 mb-4 py-1.5 group text-left rounded-brand focus-visible:outline-2"
                  onClick={() => copy("npm install && npm run build && npm start", "landing")}
                  aria-label="Copy the start command"
                >
                  <span className="text-[#7ee0b8]" aria-hidden="true">$</span>
                  <span className="text-white">npm install &amp;&amp; npm run build &amp;&amp; npm start</span>
                  <span className="ml-auto text-white/50 text-xs opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                    {copied === "landing" ? "Copied" : "Copy"}
                  </span>
                </button>

                <div className="text-white/70 mb-6">
                  <span className="text-[#22d3ee]">&gt;</span> Starting NovaRoute...<br />
                  <span className="text-[#22d3ee]">&gt;</span> Server running on <span className="text-[#818cf8]">http://localhost:20128</span><br />
                  <span className="text-[#22d3ee]">&gt;</span> Dashboard: <span className="text-[#818cf8]">http://localhost:20128/dashboard</span><br />
                  <span className="text-[#7ee0b8]">&gt;</span> Ready to route!
                </div>

                <div className="text-xs text-white/50 mb-2 border-t border-white/10 pt-4">
                  Configure providers in the dashboard or use environment variables
                </div>

                <div className="text-white/70 text-xs">
                  <span className="text-[#a855f7]">Data Location:</span><br />
                  <span className="text-white/50">  macOS/Linux:</span> ~/.novaroute/db/data.sqlite<br />
                  <span className="text-white/50">  Windows:</span> %APPDATA%/novaroute/db/data.sqlite
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
