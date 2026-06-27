import { defineRouting } from "next-intl/routing";

// English is the default and keeps the bare URLs (/, /contact, …); Thai is served
// under /th (localePrefix "as-needed"). en is the source of truth for all copy.
export const routing = defineRouting({
  locales: ["en", "th"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
