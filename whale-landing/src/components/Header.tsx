import Link from 'next/link';

const CTA_URL = process.env.NEXT_PUBLIC_SUBSCRIPTION_URL || "#pricing";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-nav transition-all duration-300">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-400 shadow-lg shadow-violet-500/20">
            <span className="absolute inset-0 rounded-xl bg-white/20 animate-pulse"></span>
          </div>
          <span className="font-bold tracking-tight text-xl text-white">Whale Intelligence</span>
        </Link>
        <a href={CTA_URL} className="btn-primary text-sm px-5 py-2 shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)]">
          Get Alerts
        </a>
      </div>
    </header>
  );
}
