import QRCode from "qrcode";

export const DEFAULT_LAN_BASE_URL = "http://10.84.23.121:3000";
export const STORAGE_KEY_QR_BASE = "tbw_cafe_qr_base_url";

/**
 * Resolves the active base URL for QR codes in prioritized order:
 * 1. Explicit override passed by caller / component state
 * 2. Owner-configured custom URL in localStorage (tbw_cafe_qr_base_url)
 * 3. Environment variable (NEXT_PUBLIC_ORDERING_BASE_URL)
 * 4. Active browser origin (if public domain or HTTPS)
 * 5. Default Wi-Fi IP fallback (http://10.84.23.121:3000)
 */
export function getBaseOrderingUrl(overrideUrl?: string): string {
  // 1. Explicit override from component state
  if (overrideUrl && overrideUrl.trim()) {
    return overrideUrl.trim().replace(/\/+$/, "");
  }

  // 2. Client-side stored owner configuration
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_QR_BASE);
      if (stored && stored.trim()) {
        return stored.trim().replace(/\/+$/, "");
      }
    } catch {
      // Ignored
    }
  }

  // 3. Environment variable
  const envUrl = process.env.NEXT_PUBLIC_ORDERING_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // 4. Current browser origin (if on a public domain, VPS, or tunnel)
  if (typeof window !== "undefined" && window.location.origin) {
    const origin = window.location.origin;
    if (
      !origin.includes("localhost") &&
      !origin.includes("127.0.0.1") &&
      !origin.includes("0.0.0.0")
    ) {
      return origin.replace(/\/+$/, "");
    }
  }

  // 5. Default to the active Wi-Fi LAN IP
  return DEFAULT_LAN_BASE_URL;
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
