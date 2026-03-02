import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Security — Sight Whale',
  description: 'Security practices and responsible disclosure process for Sight Whale.',
  alternates: { canonical: '/security' },
  openGraph: {
    title: 'Security — Sight Whale',
    description: 'Security practices and responsible disclosure process for Sight Whale.',
    type: 'website',
    url: 'https://www.sightwhale.com/security',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen text-gray-100 selection:bg-violet-500/30 overflow-hidden bg-[#0a0a0a]">
      <div className="fixed inset-0 z-[-1]">
        <div className="absolute top-[-10%] left-[-12%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="mx-auto max-w-4xl px-6 pt-32 pb-24 relative space-y-10">
        <section className="space-y-4">
          <p className="text-xs font-bold text-gray-400 tracking-[0.35em] uppercase">
            Security
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Security and responsible disclosure
          </h1>
          <p className="text-gray-400 leading-relaxed max-w-3xl">
            We take security seriously. If you find a vulnerability, we appreciate responsible
            disclosure so we can investigate and fix issues quickly.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6 text-sm text-gray-300 leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Report a vulnerability</h2>
            <p>
              Email{' '}
              <a className="text-violet-300 hover:text-violet-200 underline underline-offset-4" href="mailto:security@sightwhale.com">
                security@sightwhale.com
              </a>{' '}
              with a clear description, reproduction steps, and impact assessment. If possible, include:
            </p>
            <ul className="space-y-2">
              <li>Affected URL(s) and request/response samples (redact secrets)</li>
              <li>Steps to reproduce and expected vs. actual behavior</li>
              <li>Proof of concept (PoC) with minimal risk</li>
              <li>Suggested remediation, if you have one</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Safe harbor</h2>
            <p>
              We welcome good-faith security research. Please avoid actions that could harm users or the
              platform, such as data exfiltration, service disruption, or social engineering.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Scope</h2>
            <ul className="space-y-2">
              <li>In scope: sightwhale.com and official subdomains/services</li>
              <li>Out of scope: third-party services not controlled by Sight Whale</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">What we do</h2>
            <ul className="space-y-2">
              <li>We triage reports and respond as quickly as practical</li>
              <li>We prioritize fixes by severity and exploitability</li>
              <li>We may request additional details to validate impact</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">User data</h2>
            <p>
              Never send us secrets (API keys, passwords, private keys). If you believe you have found
              exposed data, stop and contact us immediately.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

