import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/**
 * Full-page shell for /blog — matches site-wide nav + footer (Header is fixed).
 * Used by the blog index skeleton and the hydrated client view so both show the same chrome.
 */
export default function BlogIndexShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col text-gray-100 selection:bg-violet-500/30 overflow-x-hidden bg-[#0a0a0a]">
      {/* Ambient depth — editorial “intel” atmosphere without competing with content */}
      <div className="fixed inset-0 z-[-1] pointer-events-none" aria-hidden>
        <div className="absolute top-[-10%] left-[-10%] h-[42%] w-[42%] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[42%] w-[42%] rounded-full bg-cyan-600/5 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <Header />

      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
        <header className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.35em] text-violet-400/90 sm:text-xs">
            SightWhale.com · Intelligence
          </p>
          <h1 className="mb-5 bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-4xl font-bold leading-[1.08] text-transparent sm:text-5xl md:text-6xl">
            Intelligence Log
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-400 sm:text-xl">
            Deep dives into market mechanics, signal analysis, and platform updates.
          </p>
          <div
            className="mx-auto mt-10 h-px w-20 bg-gradient-to-r from-transparent via-violet-500/45 to-transparent"
            aria-hidden
          />
        </header>

        {children}
      </main>

      <Footer />
    </div>
  );
}
