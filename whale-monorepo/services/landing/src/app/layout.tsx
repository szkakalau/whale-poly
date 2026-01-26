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
  title: "Sight Whale — Polymarket Whale Intelligence",
  description: "Track Polymarket Whale Activity — Before the Crowd Reacts. Private intelligence alerts delivered to your Telegram via Sight Whale.",
  openGraph: {
    title: "Sight Whale — Polymarket Whale Intelligence",
    description: "Private intelligence alerts based on historically profitable whale behavior.",
    type: "website",
    url: "https://sightwhale.com/",
    siteName: "Sight Whale",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sight Whale — Polymarket Whale Intelligence",
    description: "Private intelligence alerts delivered to your Telegram via Sight Whale.",
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
