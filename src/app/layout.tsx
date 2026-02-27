import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { VoiceOverlay } from "@/components/VoiceOverlay";
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
  title: "Guided Growth — Voice POC",
  description:
    "Voice-led Life OS prototype with Web Speech API for hands-free habit tracking and personal development.",
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
        <VoiceOverlay />
      </body>
    </html>
  );
}
