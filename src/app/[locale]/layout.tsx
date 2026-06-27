import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Inter, JetBrains_Mono, Prompt } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Inter — the primary typeface. Weight + tight tracking carry personality at display
// sizes; the brand's selective-bold-word device does the rest.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// JetBrains Mono — the monospace typeface (footer labels, badge hint, contact details).
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// Prompt — the THAI typeface. Inter has no Thai glyphs, so in the body font stack
// (Inter → Prompt) Latin renders in Inter and Thai falls through to Prompt: English
// words inside Thai automatically stay Inter. Not preloaded (only fetched when Thai
// glyphs are actually rendered, i.e. on /th), so English pages pay nothing.
const prompt = Prompt({
  variable: "--font-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

// IBM Plex Sans Thai — the Thai companion for MONOSPACE fields (footer labels, badge hint,
// contact details, the export caption). JetBrains Mono has no Thai glyphs, so Thai there falls
// through to this — the Thai member of the IBM Plex family, drawn alongside IBM Plex Mono, so it
// keeps a clean technical feel in mono contexts. Not preloaded (only fetched on /th).
const ibmPlexThai = IBM_Plex_Sans_Thai({
  variable: "--font-thai-mono",
  subsets: ["thai"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Srang Tech Mai - Structure for what's next",
  description:
    "Srang Tech Mai builds systems that generate identity. A generative ring engine turns any input into deterministic, animated form.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Enable static rendering for this locale.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jetbrainsMono.variable} ${prompt.variable} ${ibmPlexThai.variable}`}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
