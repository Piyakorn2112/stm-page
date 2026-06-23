import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is the site's single typeface. We lean on weight + tight tracking at
// display sizes (and the brand's selective-bold-word device) for personality,
// rather than a second display family. Data/labels use a system monospace.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Srang Tech Mai - Structure for what's next",
  description:
    "Srang Tech Mai builds systems that generate identity. A generative ring engine turns any input into deterministic, animated form.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
