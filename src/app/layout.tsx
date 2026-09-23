import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DOMAIN-MASTER — Free domain availability + .dev discovery",
  description: "Search domain availability via RDAP + discover free domains (.dev via Cloudflare Workers, .app via Firebase, .eu.org, .js.org, .github.io, .trycloudflare.com, and more).",
  keywords: ["domain", "RDAP", "WHOIS", "free domain", ".dev", "workers.dev", "eu.org", "availability", "DOMAIN-MASTER"],
  authors: [{ name: "epicaltrendweb-web" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    title: "DOMAIN-MASTER",
    description: "Free domain availability + .dev subdomain discovery (via Cloudflare Workers).",
    url: "https://github.com/epicaltrendweb-web/DOMAIN-MASTER",
    siteName: "DOMAIN-MASTER",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "DOMAIN-MASTER",
    description: "Free domain availability + .dev discovery",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
