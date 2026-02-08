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
  title: "Sight Whale — Polymarket Whale Intelligence & Real-time Alerts",
  description: "Track Polymarket Whale Activity — Before the Crowd Reacts. Get real-time, on-chain intelligence on historically profitable whale behavior delivered to your Telegram.",
  keywords: ["Polymarket", "Whale Intelligence", "Prediction Markets", "DeFi Alerts", "Crypto Trading Signals", "Smart Money Tracking", "On-chain Analytics"],
  openGraph: {
    title: "Sight Whale — Polymarket Whale Intelligence & Real-time Alerts",
    description: "Follow the smart money on Polymarket. Real-time alerts on high-conviction whale moves before they hit the headlines.",
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
    title: "Sight Whale — Follow Polymarket Smart Money & Whale Alerts",
    description: "Track the world's most profitable prediction market whales in real-time. Frontrun the crowd with Sight Whale.",
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
