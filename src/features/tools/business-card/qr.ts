/**
 * qr — a real, scannable QR code for the card back. The encoded URL is FIXED (the
 * company site), so the module matrix is computed once and cached. Output is a single
 * SVG path in MODULE units (a `count × count` grid), which the caller scales and
 * colours — we paint the modules white on a dark chip so it scans on any accent.
 */
import qrcode from "qrcode-generator";

export type QrCode = { count: number; path: string };

const cache = new Map<string, QrCode>();

/** Build (once per URL) the QR module matrix as a compact, run-length SVG path. */
export function qrCode(text: string): QrCode {
  const hit = cache.get(text);
  if (hit) return hit;

  const qr = qrcode(0, "M"); // auto version, ~15% error correction
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();

  // merge horizontal runs of dark modules per row → far fewer path commands
  let path = "";
  for (let r = 0; r < count; r++) {
    let c = 0;
    while (c < count) {
      if (!qr.isDark(r, c)) {
        c++;
        continue;
      }
      let len = 1;
      while (c + len < count && qr.isDark(r, c + len)) len++;
      path += `M${c} ${r}h${len}v1h-${len}z`;
      c += len;
    }
  }

  const code = { count, path };
  cache.set(text, code);
  return code;
}
