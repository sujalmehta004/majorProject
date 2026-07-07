import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FullscreenRestorer from "./FullscreenRestorer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MedHub — Pharmaceutical Supply Chain Platform",
  description: "Connected pharmaceutical supply chain management for wholesalers, retailers, and clinics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" style={{ fontFamily: "'Inter', var(--font-geist-sans), system-ui, -apple-system, sans-serif" }} suppressHydrationWarning>
        <FullscreenRestorer />
        {children}
      </body>
    </html>
  );
}
