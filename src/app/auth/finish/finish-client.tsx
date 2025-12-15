"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/browser";

function hasHashParams(hash: string) {
  return (
    hash.includes("access_token=") ||
    hash.includes("refresh_token=") ||
    hash.includes("error=") ||
    hash.includes("token_hash=")
  );
}

export function FinishClient() {
  React.useEffect(() => {
    const run = async () => {
      const currentUrl = new URL(window.location.href);
      const search = currentUrl.search;

      // If PKCE params are present, bounce back to the server callback handler.
      const params = new URLSearchParams(search);
      if (params.get("code") || (params.get("token_hash") && params.get("type"))) {
        window.location.replace(`/auth/callback${search}`);
        return;
      }

      const hash = window.location.hash ?? "";
      if (!hash || !hasHashParams(hash)) {
        window.location.replace("/login?reason=invalid-link");
        return;
      }

      const supabase = createClient();

      const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
      if (hashParams.get("error")) {
        window.history.replaceState({}, "", `${currentUrl.pathname}${search}`);
        window.location.replace("/login?reason=invalid-link");
        return;
      }

      // Remove tokens from the URL as early as possible.
      window.history.replaceState({}, "", `${currentUrl.pathname}${search}`);

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (!accessToken || !refreshToken) {
        window.location.replace("/login?reason=invalid-link");
        return;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error || !data?.session) {
        try {
          await supabase.auth.signOut();
        } catch {
          // best-effort
        }
        window.location.replace("/login?reason=invalid-link");
        return;
      }

      window.location.replace(`/auth/callback${search}`);
    };

    void run();
  }, []);

  return null;
}
