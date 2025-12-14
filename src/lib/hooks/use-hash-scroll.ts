import * as React from "react";

type Options = {
  ids?: string[];
  maxAttempts?: number;
};

function normalizeId(input: string) {
  return input.replace(/^#/, "").trim();
}

export function useHashScroll(options?: Options) {
  const ids = options?.ids ?? [];
  const maxAttempts = Math.max(1, Math.min(60, options?.maxAttempts ?? 24));

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = normalizeId(window.location.hash);
    const search = new URLSearchParams(window.location.search);
    const sectionParam = normalizeId(search.get("section") ?? "");

    const candidate = hash || sectionParam;
    if (!candidate) return;
    if (ids.length && !ids.includes(candidate)) return;

    let cancelled = false;
    let attempt = 0;
    let raf: number | null = null;

    const scrollToTarget = () => {
      attempt += 1;
      const el = document.getElementById(candidate);
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "auto" });
        if (!hash && sectionParam) {
          const base = `${window.location.pathname}${window.location.search}`;
          window.history.replaceState(null, "", `${base}#${candidate}`);
        }
        return;
      }
      if (attempt >= maxAttempts) return;
      raf = window.requestAnimationFrame(() => {
        if (cancelled) return;
        scrollToTarget();
      });
    };

    scrollToTarget();

    return () => {
      cancelled = true;
      if (raf != null) window.cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join("|")]);
}

