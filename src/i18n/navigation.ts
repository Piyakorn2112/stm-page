import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware navigation: <Link>, useRouter, usePathname, redirect all preserve the
// active locale prefix automatically. Use these for internal links + the locale switcher.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
