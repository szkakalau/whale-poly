import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DM_Sans, JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "600", "700", "800"],
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
};

export const metadata: Metadata = {
  title: "SightWhale.com — Follow Smart Money on Polymarket & Win More",
  description: "Stop guessing. Follow the top 1% of profitable whales on Polymarket. Real-time Telegram alerts for high-conviction bets on Elections, Sports, and Crypto.",
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
    "Real-time Odds Tracking"
  ],
  openGraph: {
    title: "SightWhale.com — Follow Smart Money on Polymarket & Win More",
    description: "Stop guessing. Follow the top 1% of profitable whales on Polymarket. Real-time Telegram alerts for high-conviction bets on Elections, Sports, and Crypto.",
    type: "website",
    url: "https://www.sightwhale.com/",
    siteName: "SightWhale.com",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SightWhale.com — Follow the Smart Money on Polymarket and Prediction Markets"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "SightWhale.com — Follow Smart Money on Polymarket & Win More",
    description: "Stop guessing. Follow the top 1% of profitable whales on Polymarket. Real-time Telegram alerts for high-conviction bets on Elections, Sports, and Crypto.",
    images: ["/opengraph-image"]
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
  metadataBase: new URL("https://www.sightwhale.com"),
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${sora.variable} ${jetbrainsMono.variable}`}
    >
      <body className={`${dmSans.className} antialiased`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
