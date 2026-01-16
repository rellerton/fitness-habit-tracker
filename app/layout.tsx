import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fitness Habit Tracker",
  description: "Cricular Grid Style Fitness Tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ingressPath = headers().get("x-ingress-path") ?? "";
  const baseHref =
    ingressPath && ingressPath !== "/"
      ? `${ingressPath.replace(/\/$/, "")}/`
      : "/";

  return (
    <html lang="en" className="h-full">
      <head>
        <base href={baseHref} />
      </head>
      <body className="h-full bg-[#111111] text-slate-100 antialiased">
        <div className="min-h-full bg-[#111111]">{children}</div>
      </body>
    </html>
  );
}
