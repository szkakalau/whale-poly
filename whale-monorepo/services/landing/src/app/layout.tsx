import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Sight Whale — Follow Smart Money on Polymarket & Win More",
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
    title: "Sight Whale — Follow Smart Money on Polymarket & Win More",
    description: "Stop guessing. Follow the top 1% of profitable whales on Polymarket. Real-time Telegram alerts for high-conviction bets on Elections, Sports, and Crypto.",
    type: "website",
    url: "https://www.sightwhale.com/",
    siteName: "Sight Whale",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Sight Whale — Follow the Smart Money on Polymarket and Prediction Markets"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Sight Whale — Follow Smart Money on Polymarket & Win More",
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
    <html lang="en">
      <body
        className="antialiased"
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
