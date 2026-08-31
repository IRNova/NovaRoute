"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// "Docs" and "GitHub" pointed at the upstream author's repo. Removed until
// IRNova has its own; the in-app pages are the honest destination for now.
const LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Dashboard", href: "/dashboard" },
];

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  return (
    <nav className="fixed top-0 z-50 w-full bg-[color:var(--nav-bg)] backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer bg-transparent border-none p-0"
          onClick={() => router.push("/")}
          aria-label="NovaRoute home"
        >
          <div className="size-8 rounded-brand bg-nova-gradient flex items-center justify-center shadow-[var(--shadow-accent)] overflow-hidden">
            <img src="/logo-mark-mono.svg" alt="" aria-hidden="true" className="size-6 object-contain" />
          </div>
          <span className="text-text-main text-xl font-bold tracking-tight">NovaRoute</span>
        </button>

        <div className="hidden md:flex items-center gap-8">
          {LINKS.map((l) => (
            <a
              key={l.label}
              className="text-text-muted hover:text-text-main text-sm font-medium transition-colors flex items-center gap-1 py-2.5"
              href={l.href}
              {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {l.label}
              {l.external && (
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  open_in_new
                </span>
              )}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="hidden sm:flex h-9 items-center justify-center rounded-brand px-4 bg-[image:var(--grad)] text-[color:var(--on-accent)] text-sm font-bold shadow-[var(--shadow-accent)] transition-[filter,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:brightness-[1.06] active:scale-[0.97]"
          >
            Get Started
          </button>
          <button
            type="button"
            className="md:hidden flex items-center justify-center size-10 rounded-brand text-text-main hover:bg-surface-2 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-[color:var(--nav-bg)] backdrop-blur-md">
          <div className="flex flex-col gap-1 p-4">
            {LINKS.map((l) => (
              <a
                key={l.label}
                className="text-text-muted hover:text-text-main text-sm font-medium transition-colors py-3 px-2 rounded-brand hover:bg-surface-2"
                href={l.href}
                onClick={() => setMobileMenuOpen(false)}
                {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {l.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-2 h-11 rounded-brand bg-[image:var(--grad)] text-[color:var(--on-accent)] text-sm font-bold"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
