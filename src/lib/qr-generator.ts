import QRCode from "qrcode";

export function getTableOrderingUrl(tableCode: string, nonce?: string): string {
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "http://localhost:3000";

  const formattedCode = tableCode.padStart(2, "0");
  const base = `${origin}/t/${formattedCode}`;
  return nonce ? `${base}?ref=${encodeURIComponent(nonce)}` : base;
}

export async function generateTableQrDataUrl(
  tableCode: string,
  nonce?: string
): Promise<string> {
  const url = getTableOrderingUrl(tableCode, nonce);
  return QRCode.toDataURL(url, {
    width: 600,
    margin: 2,
    color: {
      dark: "#1A1108",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
  });
}

export async function generateTableQrSvg(
  tableCode: string,
  nonce?: string
): Promise<string> {
  const url = getTableOrderingUrl(tableCode, nonce);
  return QRCode.toString(url, {
    type: "svg",
    margin: 2,
    color: {
      dark: "#1A1108",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
  });
}

