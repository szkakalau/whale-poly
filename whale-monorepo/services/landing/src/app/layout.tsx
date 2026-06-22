import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
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
};

export const metadata: Metadata = {
  title: {
    default: "SightWhale.com — Follow Smart Money on Polymarket",
    template: "%s · SightWhale.com",
  },
  description:
    "Stop guessing. Follow the top 1% of profitable whales on Polymarket. Real-time Telegram alerts for high-conviction bets on Elections, Sports, and Crypto.",
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
      className={`${newsreader.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className={`${inter.className} antialiased`}>
        <Header />
        <main className="min-h-screen pt-14 sm:pt-16">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
