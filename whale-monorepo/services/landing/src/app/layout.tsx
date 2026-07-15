import type { Metadata } from "next";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: {
    default: "SightWhale.com — Follow Smart Money on Polymarket",
    template: "%s · SightWhale.com",
  },
  description:
    "Follow the top 1% of Polymarket whales. Real-time Telegram alerts for high-conviction bets on Elections, Sports, and Crypto.",
  keywords: [
    "Polymarket",
    "Polymarket Whale Intelligence",
    "Prediction Markets",
    "DeFi Alerts",
    "Crypto Trading Signals",
    "Smart Money Tracking",
    "On-chain Analytics",
    "Election Betting Odds",
    "Trump Odds",
    "Sports Betting Strategy",
    "Crypto Alpha",
    "Real-time Odds Tracking",
  ],
  openGraph: {
    title: "SightWhale.com — Follow Smart Money on Polymarket",
    description:
      "Stop guessing. Follow the top 1% of profitable whales on Polymarket. Real-time Telegram alerts.",
    type: "website",
    url: "https://www.sightwhale.com/",
    siteName: "SightWhale.com",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SightWhale.com — Follow the Smart Money on Polymarket",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SightWhale.com — Follow Smart Money on Polymarket",
    description:
      "Stop guessing. Follow the top 1% of profitable whales on Polymarket. Real-time Telegram alerts.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  metadataBase: new URL("https://www.sightwhale.com"),
  alternates: {
    canonical: "/",
    types: {
      'application/rss+xml': '/blog/feed.xml',
    },
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.sightwhale.com/#org',
      name: 'SightWhale',
      url: 'https://www.sightwhale.com',
      logo: 'https://www.sightwhale.com/opengraph-image',
      description:
        'Polymarket whale intelligence platform — real-time alerts for high-conviction trades from the top 1% most profitable wallets.',
      sameAs: ['https://twitter.com/SightWhale'],
      foundingDate: '2025',
    },
    {
      '@type': 'WebSite',
      name: 'SightWhale',
      url: 'https://www.sightwhale.com',
      description:
        'Follow smart money on Polymarket. Real-time Telegram alerts for whale trades on Elections, Sports, and Crypto.',
      publisher: { '@id': 'https://www.sightwhale.com/#org' },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://www.sightwhale.com/analyze?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, headersList] = await Promise.all([getCurrentUser(), headers()]);
  const lang = headersList.get('x-html-lang') || 'en';
  return (
    <html
      lang={lang}
      className={`${newsreader.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className={`${inter.className} antialiased`}>
        {/* JSON-LD structured data — Organization + WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header user={user} />
        <main className="min-h-screen pt-14 sm:pt-16">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
