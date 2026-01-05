/**
 * Client-side cookie utilities
 */

const IS_PRODUCTION = typeof window !== "undefined" && window.location.protocol === "https:";

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Set a cookie with optional expiration in days
 */
export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = IS_PRODUCTION ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

/* -------------------------------------------------------------------------- */
/*                  Timestamp-based "hidden until" helpers                    */
/* -------------------------------------------------------------------------- */

/**
 * Get the "hidden until" timestamp from a cookie.
 * Returns null if cookie is missing or invalid.
 */
export function getHiddenUntil(name: string): number | null {
  const raw = getCookie(name);
  if (!raw) return null;
  const ts = parseInt(raw, 10);
  return isNaN(ts) ? null : ts;
}

/**
 * Check if a "hidden until" cookie has expired (or is missing).
 * Returns true if the feature should be shown (i.e., cookie missing or expired).
 */
export function isHiddenUntilExpired(name: string): boolean {
  const hiddenUntil = getHiddenUntil(name);
  if (hiddenUntil === null) return true; // No cookie = show
  return Date.now() >= hiddenUntil;
}

/**
 * Set a "hidden until" cookie with the given number of days from now.
 * Value stored is Unix timestamp in milliseconds.
 */
export function setHiddenForDays(name: string, days: number): void {
  const hiddenUntil = Date.now() + days * 864e5;
  setCookie(name, String(hiddenUntil), days);
}

