/**
 * ZIP code geocoding utilities for map visualization.
 * Provides caching (memory + localStorage) and rate-limiting.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZIP Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize ZIP code to 5-digit format.
 * Accepts: "12345", "12345-6789", "12345 6789", "012345", etc.
 * Returns null if invalid.
 */
export function normalizeZip(input: unknown): string | null {
  if (input === null || input === undefined) return null;

  const str = String(input).trim();
  if (!str) return null;

  // Extract first 5 digits (handles ZIP+4 formats)
  const digits = str.replace(/[^0-9]/g, "");

  // US ZIP codes are 5 digits (can start with 0)
  if (digits.length < 5) return null;

  const zip5 = digits.slice(0, 5);

  // Basic US ZIP validation: 00000-99999, but 00000 is not valid
  if (zip5 === "00000") return null;

  return zip5;
}

/**
 * Validate if a normalized ZIP looks valid (basic check).
 */
export function isValidZip(zip: string | null | undefined): boolean {
  if (!zip) return false;
  return /^[0-9]{5}$/.test(zip) && zip !== "00000";
}

// ─────────────────────────────────────────────────────────────────────────────
// Caching
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = "v1";
const CACHE_KEY = `warp_zip_geocode_${CACHE_VERSION}`;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_CACHE_ENTRIES = 500; // Prevent cache bloat

interface CacheEntry {
  lat: number;
  lng: number;
  ts: number; // timestamp
}

type CacheData = Record<string, CacheEntry>;

// In-memory cache for current session
const memoryCache = new Map<string, LatLng | null>();

// Type-safe check for browser environment
function getLocalStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } | null {
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).localStorage;
  }
  return null;
}

function loadLocalStorageCache(): CacheData {
  const storage = getLocalStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as CacheData;
    const now = Date.now();
    // Filter expired entries
    const valid: CacheData = {};
    for (const [zip, entry] of Object.entries(data)) {
      if (now - entry.ts < CACHE_TTL_MS) {
        valid[zip] = entry;
      }
    }
    return valid;
  } catch {
    return {};
  }
}

/**
 * Evict oldest entries to stay under MAX_CACHE_ENTRIES.
 * Uses LRU strategy based on timestamp.
 */
function evictOldestEntries(data: CacheData): CacheData {
  const entries = Object.entries(data);
  if (entries.length <= MAX_CACHE_ENTRIES) return data;

  // Sort by timestamp ascending (oldest first)
  entries.sort((a, b) => a[1].ts - b[1].ts);

  // Keep only the newest entries
  const toKeep = entries.slice(entries.length - MAX_CACHE_ENTRIES);
  const result: CacheData = {};
  for (const [zip, entry] of toKeep) {
    result[zip] = entry;
  }
  return result;
}

function saveToLocalStorageCache(zip: string, coords: LatLng): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    let data = loadLocalStorageCache();
    data[zip] = { lat: coords.lat, lng: coords.lng, ts: Date.now() };
    // Evict oldest if over limit
    data = evictOldestEntries(data);
    storage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full or unavailable
  }
}

function getFromCache(zip: string): LatLng | null | undefined {
  // Check memory cache first
  if (memoryCache.has(zip)) {
    return memoryCache.get(zip);
  }

  // Check localStorage cache
  const lsCache = loadLocalStorageCache();
  if (lsCache[zip]) {
    const { lat, lng } = lsCache[zip];
    const coords = { lat, lng };
    memoryCache.set(zip, coords);
    return coords;
  }

  return undefined; // Not in cache
}

function setInCache(zip: string, coords: LatLng | null): void {
  memoryCache.set(zip, coords);
  if (coords) {
    saveToLocalStorageCache(zip, coords);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting / concurrency control
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CONCURRENT = 4;
let inFlight = 0;
const queue: Array<() => void> = [];

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    const next = queue.shift();
    if (next) next();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Geocoding API (zippopotam.us - free, no API key)
// ─────────────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 6000;
const MAX_RETRIES = 1;
const BASE_RETRY_DELAY_MS = 500;

interface ZippopotamResponse {
  places?: Array<{ latitude: string; longitude: string }>;
}

/** Add jitter to retry delay to avoid thundering herd. */
function getRetryDelay(attempt: number): number {
  const jitter = Math.random() * 200;
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + jitter;
}

async function fetchWithRetry(
  url: string,
  signal?: AbortSignal
): Promise<Response | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      // If parent signal is provided, abort on parent abort
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort);

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);

        // Retry on 429 (rate limit) or 5xx errors
        if (res.status === 429 || res.status >= 500) {
          if (attempt < MAX_RETRIES) {
            await sleep(getRetryDelay(attempt));
            continue;
          }
          return null;
        }

        return res;
      } catch {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);

        // If aborted by parent signal, don't retry
        if (signal?.aborted) return null;

        // Retry on network errors
        if (attempt < MAX_RETRIES) {
          await sleep(getRetryDelay(attempt));
          continue;
        }
        return null;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchZipCoords(
  zip: string,
  signal?: AbortSignal
): Promise<LatLng | null> {
  try {
    const res = await fetchWithRetry(
      `https://api.zippopotam.us/us/${zip}`,
      signal
    );

    if (!res || !res.ok) return null;

    const data = (await res.json()) as ZippopotamResponse;
    if (!data.places || data.places.length === 0) return null;

    const place = data.places[0];
    if (!place) return null;
    const lat = parseFloat(place.latitude);
    const lng = parseFloat(place.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Get lat/lng for a ZIP code with caching.
 * Returns null if ZIP is invalid or geocoding fails.
 * @param zip - The ZIP code to geocode
 * @param signal - Optional AbortSignal for cancellation
 */
export async function getLatLngForZip(
  zip: string,
  signal?: AbortSignal
): Promise<LatLng | null> {
  const normalized = normalizeZip(zip);
  if (!normalized) return null;

  // Check cache first
  const cached = getFromCache(normalized);
  if (cached !== undefined) return cached;

  // Check if aborted before fetching
  if (signal?.aborted) return null;

  // Fetch with concurrency limit
  const coords = await withConcurrencyLimit(() =>
    fetchZipCoords(normalized, signal)
  );

  // Only cache if not aborted
  if (!signal?.aborted) {
    setInCache(normalized, coords);
  }

  return coords;
}

export interface BatchGeocodeOptions {
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Batch geocode multiple ZIP codes.
 * Returns a map of zip -> LatLng (only successful lookups).
 * @param zips - Array of ZIP codes to geocode
 * @param options - Optional AbortSignal and progress callback
 */
export async function batchGeocodeZips(
  zips: string[],
  options?: BatchGeocodeOptions
): Promise<Map<string, LatLng>> {
  const { signal, onProgress } = options ?? {};
  const results = new Map<string, LatLng>();
  const unique = [
    ...new Set(zips.map(normalizeZip).filter(Boolean) as string[]),
  ];

  if (unique.length === 0) return results;

  let completed = 0;

  await Promise.all(
    unique.map(async (zip) => {
      if (signal?.aborted) return;

      const coords = await getLatLngForZip(zip, signal);
      if (coords && !signal?.aborted) {
        results.set(zip, coords);
      }

      completed++;
      onProgress?.(completed, unique.length);
    })
  );

  return results;
}

/**
 * Clear the geocoding cache (useful for testing).
 */
export function clearGeoCache(): void {
  memoryCache.clear();
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.removeItem(CACHE_KEY);
    } catch {
      // Ignore
    }
  }
}

