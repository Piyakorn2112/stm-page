import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Handles locale detection + the /th prefix (en stays unprefixed via "as-needed").
export default createMiddleware(routing);

export const config = {
  // Run on everything except API routes, Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
