import * as React from "react";

function getCssPxVar(name: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw.replace("px", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickActiveId(ids: string[], offsetPx: number) {
  const candidates: Array<{ id: string; top: number }> = [];

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();

    // Exclude sections that are fully above the reading line.
    if (rect.bottom <= offsetPx) continue;
    // Exclude sections far below viewport.
    if (rect.top >= window.innerHeight) continue;

    candidates.push({ id, top: rect.top });
  }

  if (!candidates.length) return null;

  // Prefer the section whose top is closest *above* the reading line.
  const above = candidates.filter((c) => c.top <= offsetPx);
  if (above.length) {
    return above.reduce((best, next) => (next.top > best.top ? next : best)).id;
  }

  // Otherwise, take the closest section below the reading line.
  return candidates.reduce((best, next) => (next.top < best.top ? next : best)).id;
}

export function useScrollSpy(ids: string[]) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const activeRef = React.useRef<string | null>(null);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ids.length) return;

    const offsetPx = getCssPxVar("--warp-anchor-offset", 96);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (!elements.length) return;

    function scheduleCompute() {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const next = pickActiveId(ids, offsetPx);
        if (!next || next === activeRef.current) return;
        activeRef.current = next;
        setActiveId(next);
      });
    }

    const observer = new IntersectionObserver(scheduleCompute, {
      root: null,
      threshold: [0, 0.1],
      rootMargin: `-${Math.round(offsetPx)}px 0px -55% 0px`,
    });

    for (const el of elements) observer.observe(el);

    scheduleCompute();

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      observer.disconnect();
    };
  }, [ids]);

  return { activeId };
}
