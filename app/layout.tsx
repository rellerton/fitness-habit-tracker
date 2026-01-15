import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // headers() IS ASYNC in App Router
  const h = await headers();

  // Only present in HA ingress (we inject via nginx)
  const ingress = h.get("x-ingress-path") ?? "";

  // Only set <base> when ingress exists (HA only)
  const baseHref = ingress
    ? `${ingress.replace(/\/$/, "")}/`
    : null;

  return (
    <html lang="en" className="h-full">
      <head>{baseHref ? <base href={baseHref} /> : null}</head>

      <body className="h-full bg-slate-950 text-slate-100 antialiased">
        <div className="min-h-full bg-slate-950">{children}</div>
      </body>
    </html>
  );
}
