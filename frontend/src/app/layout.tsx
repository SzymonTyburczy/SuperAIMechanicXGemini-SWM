import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AutoMechanic AI — Intelligent Repair Estimation",
  description: "AI-powered vehicle damage analysis and repair cost estimation. Upload photos, get instant analysis, find cheaper parts, and compare workshops.",
  keywords: "car repair estimate, AI mechanic, vehicle damage analysis, repair cost calculator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
