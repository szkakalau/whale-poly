import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sight Whale — Follow Smart Money on Polymarket & Win More",
  description: "Stop guessing. Follow the top 1% of profitable whales on Polymarket. Real-time Telegram alerts for high-conviction bets on Elections, Sports, and Crypto.",
  keywords: [
    "Polymarket", 
    "Whale Intelligence", 
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
    url: "https://sightwhale.com/",
    siteName: "Sight Whale",
    locale: "en_US",
    images: [
      {
        url: "/images/og-image.png",
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
    images: ["/images/og-image.png"]
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
  metadataBase: new URL("https://sightwhale.com"),
  alternates: {
    canonical: './',
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
