"use client";

// Outbound links used to point at the upstream author's GitHub repo and npm
// package, so "Documentation", "GitHub" and "NPM" all sent visitors to a third
// party, and "NPM" in particular advertised a package that is not this build.
// They are gone until IRNova has its own; the in-app equivalents stay.
const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Agent Skills", href: "/dashboard/skills" },
      { label: "Endpoint", href: "/dashboard/endpoint" },
    ],
  },
];

function FooterLink({ label, href, external }) {
  return (
    <a
      className="text-text-muted hover:text-primary text-sm transition-colors py-1.5 -my-1.5"
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {label}
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-alt pt-16 pb-8 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-6 rounded-brand bg-nova-gradient flex items-center justify-center overflow-hidden">
                <img src="/logo-mark-mono.svg" alt="" aria-hidden="true" className="size-5 object-contain" />
              </div>
              <span className="text-text-main text-lg font-bold">NovaRoute</span>
            </div>
            <p className="text-text-muted text-sm max-w-xs mb-6">
              The unified endpoint for AI generation. Connect, route, and manage your AI providers with ease.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-4">
              <h2 className="font-bold text-text-main text-sm">{col.title}</h2>
              {col.links.map((l) => (
                <FooterLink key={l.label} {...l} />
              ))}
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-text-subtle text-sm">
            © {new Date().getFullYear()} NovaRoute. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
