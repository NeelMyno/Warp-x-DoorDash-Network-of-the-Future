/**
 * Cookie utilities for tour cooldown and resume state
 */

const COOKIE_EXPIRE_DAYS_DEFAULT = 365;

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Set a cookie with optional expiration days
 */
export function setCookie(name: string, value: string, days: number = COOKIE_EXPIRE_DAYS_DEFAULT): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Delete a cookie by setting it to expire immediately
 */
export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

/* -------------------------------------------------------------------------- */
/*                         Tour-specific helpers                              */
/* -------------------------------------------------------------------------- */

/**
 * Check if a "hidden until" cookie has expired (meaning we should show the tour)
 * Returns true if the tour should be shown (cookie missing or expired)
 */
export function isHiddenUntilExpired(cookieName: string): boolean {
  const value = getCookie(cookieName);
  if (!value) return true; // No cookie = show tour
  const hiddenUntil = parseInt(value, 10);
  if (isNaN(hiddenUntil)) return true;
  return Date.now() >= hiddenUntil;
}

/**
 * Set a "hidden until" cookie for N days from now
 */
export function setHiddenForDays(cookieName: string, days: number): void {
  const hiddenUntil = Date.now() + days * 24 * 60 * 60 * 1000;
  setCookie(cookieName, String(hiddenUntil), days + 1);
}

/**
 * Get the resume step from cookie (for tour pause/resume)
 */
export function getResumeStep(cookieName: string): number | null {
  const value = getCookie(cookieName);
  if (!value) return null;
  const step = parseInt(value, 10);
  return isNaN(step) ? null : step;
}

/**
 * Set the resume step cookie
 */
export function setResumeStep(cookieName: string, step: number, days: number = 30): void {
  setCookie(cookieName, String(step), days);
}

/**
 * Clear the resume step cookie
 */
export function clearResumeStep(cookieName: string): void {
  deleteCookie(cookieName);
}

