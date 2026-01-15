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
  title: "Fitness Habit Tracker",
  description: "Cricular Grid Style Fitness Tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="h-full bg-slate-950 text-slate-100 antialiased">
        <div className="min-h-full bg-slate-950">{children}</div>
      </body>
    </html>
  );
}
