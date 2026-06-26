import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Inter — the primary typeface. Weight + tight tracking carry personality at display
// sizes; the brand's selective-bold-word device does the rest.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// JetBrains Mono — the monospace typeface (footer labels, badge hint, contact details).
// Loaded via next/font so it self-hosts and renders identically on every browser/OS,
// replacing the old ui-monospace/SF Mono/Menlo system-font stack.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
