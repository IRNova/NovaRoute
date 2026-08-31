"use client";
import { useRouter } from "next/navigation";
import Navigation from "./components/Navigation";
import HeroSection from "./components/HeroSection";
import FlowAnimation from "./components/FlowAnimation";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import GetStarted from "./components/GetStarted";
import Footer from "./components/Footer";

export default function LandingPage() {
  const router = useRouter();
  return (
    <div className="relative bg-bg text-text-main font-sans overflow-x-hidden antialiased">
      {/*
        Atmosphere layer. This used to be a fixed dark panel painted with
        literal hex, so the page rendered dark even in light mode and any
        moment the fixed layer failed to cover (print, overscroll, forced
        colors) you saw a patchwork of dark and light sections underneath.
        It is now tinted from the theme tokens and sits on the real page
        background, so both themes are coherent all the way down.
      */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-[0.05] dark:opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--cyan) 1px, transparent 1px), linear-gradient(to bottom, var(--cyan) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <div className="absolute top-0 left-1/4 w-[700px] h-[700px] rounded-full blur-[130px] animate-blob bg-[color-mix(in_srgb,var(--cyan)_10%,transparent)]" />
        <div
          className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full blur-[130px] animate-blob bg-[color-mix(in_srgb,var(--violet)_10%,transparent)]"
          style={{ animationDelay: "2s", animationDuration: "22s" }}
        />
        <div
          className="absolute bottom-0 left-1/2 w-[650px] h-[650px] rounded-full blur-[130px] animate-blob bg-[color-mix(in_srgb,var(--indigo)_10%,transparent)]"
          style={{ animationDelay: "4s", animationDuration: "25s" }}
        />
      </div>

      <div className="relative z-10">
        <Navigation />

        <main>
          <div className="relative">
            <HeroSection />
            <div className="flex justify-center pb-20">
              <FlowAnimation />
            </div>
          </div>

          <GetStarted />
          <HowItWorks />
          <Features />

          {/* Closing CTA */}
          <section className="py-32 px-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-t from-[color-mix(in_srgb,var(--cyan)_6%,transparent)] to-transparent pointer-events-none" />
            <div className="max-w-4xl mx-auto text-center relative z-10">
              <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-text-main">
                Ready to Simplify Your AI Infrastructure?
              </h2>
              <p className="text-xl text-text-muted mb-10 max-w-2xl mx-auto">
                Join developers who are streamlining their AI integrations with NovaRoute. Open source and free to start.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="w-full sm:w-auto h-14 px-10 rounded-brand bg-[image:var(--grad)] text-[color:var(--on-accent)] text-lg font-bold transition-[filter,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:brightness-[1.06] active:scale-[0.98] shadow-[var(--shadow-accent)]"
                >
                  Start Free
                </button>
                {/* Was "Read Documentation" pointing at the upstream author's repo. */}
                <a
                  href="#features"
                  className="w-full sm:w-auto h-14 px-10 rounded-brand border border-border bg-surface hover:bg-surface-2 text-text-main text-lg font-bold transition-colors flex items-center justify-center"
                >
                  See Features
                </a>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 20s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-blob { animation: none; }
        }
      `}</style>
    </div>
  );
}
