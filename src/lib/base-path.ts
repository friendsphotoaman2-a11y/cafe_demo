/**
 * Multi-Zone & Base Path Configuration Helper
 * Supports deploying the application either at root '/' or under a subpath like '/demo/cafe'.
 */

// Normalized base path from environment: e.g. "/demo/cafe" or ""
export const BASE_PATH = (() => {
  const raw =
    process.env.NEXT_PUBLIC_BASE_PATH ||
    process.env.CAFE_DEMO_BASE_PATH ||
    "";
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "/") return "";
  // Ensure leading slash and strip trailing slash
  return ("/" + trimmed.replace(/^\/+|\/+$/g, "")).replace(/\/+$/, "");
})();

// Multi-zone asset prefix: e.g. "/cafe-static" or ""
export const ASSET_PREFIX = (() => {
  const raw =
    process.env.NEXT_PUBLIC_ASSET_PREFIX ||
    process.env.CAFE_DEMO_ASSET_PREFIX ||
    (BASE_PATH ? "/cafe-static" : "");
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "/") return "";
  return ("/" + trimmed.replace(/^\/+|\/+$/g, "")).replace(/\/+$/, "");
})();

/**
 * Prepends the active base path (e.g. '/demo/cafe') to relative paths.
 * Leaves external URLs (http://, https://, //, mailto:, tel:) intact.
 * Avoids duplicate prefixing if path already starts with BASE_PATH.
 */
export function withBasePath(path: string): string {
  if (!path) return BASE_PATH || "/";

  // Ignore external or protocol-based URLs
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("//") ||
    path.startsWith("mailto:") ||
    path.startsWith("tel:") ||
    path.startsWith("data:")
  ) {
    return path;
  }

  if (!BASE_PATH) {
    return path.startsWith("/") ? path : `/${path}`;
  }

  // If path already starts with BASE_PATH, don't duplicate
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`) || path.startsWith(`${BASE_PATH}?`)) {
    return path;
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${cleanPath}`;
}

/**
 * Returns the fully qualified API endpoint path respecting the active basePath.
 * Example:
 *   When BASE_PATH is ""           -> apiUrl('/api/orders') === '/api/orders'
 *   When BASE_PATH is '/demo/cafe' -> apiUrl('/api/orders') === '/demo/cafe/api/orders'
 */
export function apiUrl(path: string): string {
  return withBasePath(path);
}

/**
 * Appends BASE_PATH to a host/origin or full URL if BASE_PATH is enabled and not already present.
 * Example:
 *   withBasePathUrl('https://www.thebusinesswork.com')
 *   -> 'https://www.thebusinesswork.com/demo/cafe' (if BASE_PATH is '/demo/cafe')
 */
export function withBasePathUrl(urlOrOrigin: string): string {
  if (!urlOrOrigin) return "";
  const cleaned = urlOrOrigin.trim().replace(/\/+$/, "");
  if (!BASE_PATH) return cleaned;

  // If already ends with BASE_PATH or contains BASE_PATH as a segment
  if (cleaned.endsWith(BASE_PATH) || cleaned.includes(`${BASE_PATH}/`)) {
    return cleaned;
  }

  return `${cleaned}${BASE_PATH}`;
}

/**
 * Returns the cookie path scope.
 * Scoped to BASE_PATH when active (e.g. '/demo/cafe') to avoid cookie pollution on parent domain,
 * or '/' in root deployment.
 */
export function getCookiePath(): string {
  return BASE_PATH || "/";
}

