import {
  getTableOrderingUrl,
  generateTableQrDataUrl,
  DEFAULT_LAN_BASE_URL,
} from "../src/lib/qr-generator";

async function main() {
  console.log("=== VERIFYING ALL 12 TABLE QR PAYLOAD URLS ===\n");
  console.log(`Configured LAN Base URL: ${DEFAULT_LAN_BASE_URL}\n`);

  const results: Record<
    string,
    { url: string; qrLength: number; valid: boolean }
  > = {};

  let allPass = true;

  for (let i = 1; i <= 12; i++) {
    const code = i.toString().padStart(2, "0");
    const expectedUrl = `${DEFAULT_LAN_BASE_URL}/t/${code}`;
    const generatedUrl = getTableOrderingUrl(code);
    const qrDataUrl = await generateTableQrDataUrl(code);

    const matchesExpected = generatedUrl === expectedUrl;
    const isPngDataUrl = qrDataUrl.startsWith("data:image/png;base64,");

    results[`Table ${code}`] = {
      url: generatedUrl,
      qrLength: qrDataUrl.length,
      valid: matchesExpected && isPngDataUrl,
    };

    if (!matchesExpected || !isPngDataUrl) {
      allPass = false;
    }
  }

  console.log(JSON.stringify(results, null, 2));

  // Test custom base URL override (e.g. production domain)
  const prodBase = "https://brewandbean.in";
  const prodTable04Url = getTableOrderingUrl("04", undefined, prodBase);
  const prodPass = prodTable04Url === "https://brewandbean.in/t/04";
  console.log("\nProduction override test (Table 04):", {
    url: prodTable04Url,
    valid: prodPass,
  });

  // Test QR nonce regeneration
  const nonceUrl = getTableOrderingUrl("04", "nonce_abc123");
  const noncePass = nonceUrl.includes("ref=nonce_abc123");
  console.log("Regeneration nonce test:", { url: nonceUrl, valid: noncePass });

  if (allPass && prodPass && noncePass) {
    console.log("\n>>> ALL 12 TABLE QR GENERATION TESTS PASSED 100% <<<");
    process.exit(0);
  } else {
    console.error("\n>>> QR TEST FAILED <<<");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});

