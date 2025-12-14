"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useHashScroll } from "@/lib/hooks/use-hash-scroll";
import { useScrollSpy } from "@/lib/hooks/use-scrollspy";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AnchorItem = { id: string; label: string };

function useHasInteracted() {
  const ref = React.useRef(false);

  React.useEffect(() => {
    const onScroll = () => {
      ref.current = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return ref;
}

function baseUrl() {
  return `${window.location.pathname}${window.location.search}`;
}

export function AnchorNav({
  items,
  className,
  children,
}: {
  items: AnchorItem[];
  className?: string;
  children: React.ReactNode;
}) {
  const ids = React.useMemo(() => items.map((i) => i.id), [items]);

  useHashScroll({ ids });
  const { activeId } = useScrollSpy(ids);
  const hasInteractedRef = useHasInteracted();

  React.useEffect(() => {
    if (!activeId) return;
    if (!hasInteractedRef.current) return;
    if (window.location.hash.replace(/^#/, "") === activeId) return;
    window.history.replaceState(null, "", `${baseUrl()}#${activeId}`);
  }, [activeId, hasInteractedRef]);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    hasInteractedRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `${baseUrl()}#${id}`);
  }

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[220px_1fr]", className)}>
      <aside className="hidden lg:block">
        <nav
          aria-label="On this page"
          className={cn(
            "sticky top-[var(--warp-shell-pad)] rounded-[var(--warp-radius-lg)] border border-border bg-background/18 p-3 shadow-[var(--warp-shadow-elev-1)] backdrop-blur",
          )}
        >
          <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            On this page
          </div>
          <div className="space-y-1">
            {items.map((item) => {
              const isActive = activeId === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  aria-current={isActive ? "location" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo(item.id);
                  }}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "bg-primary/10 text-foreground shadow-[var(--shadow-elev-1)]"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full transition",
                      isActive
                        ? "bg-primary shadow-[0_0_0_6px_rgba(0,255,51,0.10)]"
                        : "bg-border group-hover:bg-primary/40",
                    )}
                  />
                  <span className={cn("truncate", isActive ? "font-medium" : "")}>
                    {item.label}
                  </span>
                </a>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-10 -mx-6 mb-6 border-b border-border/60 bg-background/12 px-6 py-3 backdrop-blur lg:hidden">
          <nav aria-label="On this page">
            <Tabs value={activeId ?? items[0]?.id ?? ""} onValueChange={scrollTo}>
              <TabsList className="h-9 w-full justify-start overflow-x-auto shadow-[var(--warp-shadow-elev-1)]">
                {items.map((item) => (
                  <TabsTrigger key={item.id} value={item.id} className="text-xs">
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </nav>
        </div>

        {children}
      </div>
    </div>
  );
}

