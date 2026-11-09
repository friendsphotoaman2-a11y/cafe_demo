import QRCode from "qrcode";
import { withBasePathUrl } from "@/lib/base-path";

export const CANONICAL_PRODUCTION_BASE_URL = "https://cafe-demo-lovat-sigma.vercel.app";
export const DEFAULT_LAN_BASE_URL = "http://10.84.23.121:3000";
export const STORAGE_KEY_QR_BASE = "tbw_cafe_qr_base_url";

/**
 * Resolves the active base URL for QR codes in prioritized order:
 * 1. Explicit override passed by caller / component state
 * 2. Current browser origin (if on a public domain or HTTPS)
 * 3. Owner-configured custom URL in localStorage (tbw_cafe_qr_base_url)
 * 4. Vercel production domain / environment variable
 * 5. Production fallback (https://cafe-demo-lovat-sigma.vercel.app)
 * 6. Local development Wi-Fi LAN IP fallback
 *
 * Automatically attaches BASE_PATH (e.g. /demo/cafe) when running in multi-zone mode.
 */
export function getBaseOrderingUrl(overrideUrl?: string): string {
  // 1. Explicit override from component state
  if (overrideUrl && overrideUrl.trim()) {
    return withBasePathUrl(overrideUrl.trim());
  }

  // 2. Current browser origin (ensures mobile scanners on production always get canonical domain)
  if (typeof window !== "undefined" && window.location.origin) {
    const origin = window.location.origin;
    if (
      !origin.includes("localhost") &&
      !origin.includes("127.0.0.1") &&
      !origin.includes("0.0.0.0")
    ) {
      return withBasePathUrl(origin);
    }
  }

  // 3. Client-side stored owner configuration
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_QR_BASE);
      if (stored && stored.trim()) {
        return withBasePathUrl(stored.trim());
      }
    } catch {
      // Ignored
    }
  }

  // 4. Vercel environment variables
  if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    return withBasePathUrl(
      `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    );
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return withBasePathUrl(
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    );
  }

  // 5. Explicit environment variable (if not localhost in production)
  const envUrl = process.env.NEXT_PUBLIC_ORDERING_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return withBasePathUrl(envUrl.trim());
  }

  // 6. Production fallback
  if (process.env.NODE_ENV === "production") {
    return withBasePathUrl(CANONICAL_PRODUCTION_BASE_URL);
  }

  // 7. Local development Wi-Fi LAN IP fallback
  return withBasePathUrl(DEFAULT_LAN_BASE_URL);
}

export function setStoredQrBaseUrl(url: string): void {
  if (typeof window === "undefined") return;
  try {
    const cleaned = url.trim().replace(/\/+$/, "");
    localStorage.setItem(STORAGE_KEY_QR_BASE, cleaned);
    window.dispatchEvent(new Event("tbw-cafe-qr-base-updated"));
  } catch {
    // Ignored
  }
}

export function resetStoredQrBaseUrl(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_QR_BASE);
    window.dispatchEvent(new Event("tbw-cafe-qr-base-updated"));
  } catch {
    // Ignored
  }
}

/**
 * Builds the canonical public ordering URL for a specific table.
 * Example: http://10.84.23.121:3000/t/04
 */
export function getTableOrderingUrl(
  tableCode: string,
  nonce?: string,
  overrideBaseUrl?: string
): string {
  const base = getBaseOrderingUrl(overrideBaseUrl);
  const formattedCode = (tableCode || "01").toString().padStart(2, "0");
  const fullPath = `${base}/t/${formattedCode}`;
  return nonce ? `${fullPath}?ref=${encodeURIComponent(nonce)}` : fullPath;
}

/**
 * Generates high-contrast, camera-friendly QR Data URL.
 * Error correction level 'M' produces clear, easily scannable modules for standard smartphone cameras.
 */
export async function generateTableQrDataUrl(
  tableCode: string,
  nonce?: string,
  overrideBaseUrl?: string
): Promise<string> {
  const url = getTableOrderingUrl(tableCode, nonce, overrideBaseUrl);
  return QRCode.toDataURL(url, {
    width: 600,
    margin: 3,
    color: {
      dark: "#18181B", // Zinc-900 for ultra-sharp camera contrast
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
  });
}

export async function generateTableQrSvg(
  tableCode: string,
  nonce?: string,
  overrideBaseUrl?: string
): Promise<string> {
  const url = getTableOrderingUrl(tableCode, nonce, overrideBaseUrl);
  return QRCode.toString(url, {
    type: "svg",
    margin: 3,
    color: {
      dark: "#18181B",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
  });
}
