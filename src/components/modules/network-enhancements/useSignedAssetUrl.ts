"use client";

import * as React from "react";

type RefreshResponse = { url: string; expiresAt: string };

export function useSignedAssetUrl(input: {
  assetId: string | null;
  url: string | null;
  expiresAt: string | null;
}) {
  const [url, setUrl] = React.useState<string | null>(input.url);
  const [expiresAt, setExpiresAt] = React.useState<string | null>(input.expiresAt);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setUrl(input.url);
    setExpiresAt(input.expiresAt);
    setRefreshError(null);
  }, [input.url, input.expiresAt]);

  const refresh = React.useCallback(async () => {
    if (!input.assetId) return { ok: false as const, error: "Missing asset id." };
    if (refreshing) return { ok: false as const, error: "Already refreshing." };

    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch(`/api/assets/signed-url?assetId=${input.assetId}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Failed to refresh (HTTP ${res.status}).`);
      }

      const data = (await res.json()) as RefreshResponse;
      if (!data?.url || !data?.expiresAt) throw new Error("Invalid response.");

      setUrl(data.url);
      setExpiresAt(data.expiresAt);
      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRefreshError(message);
      return { ok: false as const, error: message };
    } finally {
      setRefreshing(false);
    }
  }, [input.assetId, refreshing]);

  React.useEffect(() => {
    if (!input.assetId || !expiresAt || !url) return;

    const msUntilRefresh = new Date(expiresAt).getTime() - Date.now() - 60_000;
    if (!Number.isFinite(msUntilRefresh)) return;
    if (msUntilRefresh <= 0) {
      void refresh();
      return;
    }

    const handle = window.setTimeout(() => void refresh(), msUntilRefresh);
    return () => window.clearTimeout(handle);
  }, [expiresAt, input.assetId, refresh, url]);

  return { url, expiresAt, refresh, refreshing, refreshError };
}

