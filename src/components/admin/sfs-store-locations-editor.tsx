"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileUp, Plus, Search, Trash2 } from "lucide-react";

import { ContentPanel } from "@/components/panels/ContentPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StoreLocationRow = {
  store_id: string;
  store_name: string | null;
  market: string | null;
  lat: number;
  lon: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

function parseCsv(text: string): { ok: true; rows: StoreLocationRow[] } | { ok: false; error: string } {
  const normalized = text.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { ok: false, error: "CSV is empty." };

  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const storeIdIdx = idx("store_id");
  const latIdx = idx("lat");
  const lonIdx = idx("lon");
  if (storeIdIdx < 0 || latIdx < 0 || lonIdx < 0) {
    return { ok: false, error: "Missing required headers: store_id, lat, lon" };
  }
  const storeNameIdx = idx("store_name");
  const marketIdx = idx("market");

  const rows: StoreLocationRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const store_id = cols[storeIdIdx]?.trim() ?? "";
    const lat = Number(cols[latIdx]);
    const lon = Number(cols[lonIdx]);
    if (!store_id) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { ok: false, error: `Invalid lat/lon on line ${i + 1}` };
    }
    rows.push({
      store_id,
      store_name: storeNameIdx >= 0 ? (cols[storeNameIdx]?.trim() || null) : null,
      market: marketIdx >= 0 ? (cols[marketIdx]?.trim() || null) : null,
      lat,
      lon,
      is_active: true,
    });
  }
  if (rows.length === 0) return { ok: false, error: "No valid rows found in CSV." };
  return { ok: true, rows };
}

export function SfsStoreLocationsEditor() {
  const [rows, setRows] = React.useState<StoreLocationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");

  const [open, setOpen] = React.useState(false);
  const [editStoreId, setEditStoreId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<{
    store_id: string;
    store_name: string;
    market: string;
    lat: string;
    lon: string;
    is_active: boolean;
  }>({
    store_id: "",
    store_name: "",
    market: "",
    lat: "",
    lon: "",
    is_active: true,
  });

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.store_id.toLowerCase().includes(q) ||
        (r.store_name ?? "").toLowerCase().includes(q) ||
        (r.market ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, rows]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sfs-store-locations", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to load store locations");
        setRows([]);
        return;
      }
      setRows((data.locations ?? []) as StoreLocationRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ContentPanel
      title="SFS Store Locations"
      description="Warp-owned dictionary used to compute distances for density discounts."
      right={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              setForm({
                store_id: "",
                store_name: "",
                market: "",
                lat: "",
                lon: "",
                is_active: true,
              });
              setEditStoreId(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (!file) return;
                const text = await file.text();
                const parsed = parseCsv(text);
                if (!parsed.ok) {
                  toast.error(parsed.error);
                  return;
                }
                const resp = await fetch("/api/admin/sfs-store-locations", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    locations: parsed.rows.map((r) => ({
                      store_id: r.store_id,
                      store_name: r.store_name,
                      market: r.market,
                      lat: r.lat,
                      lon: r.lon,
                      is_active: true,
                    })),
                  }),
                });
                const out = await resp.json().catch(() => null);
                if (!resp.ok) {
                  toast.error(out?.error ?? "Failed to import CSV");
                  return;
                }
                toast.success("Imported store locations");
                await refresh();
              }}
            />
            <span>
              <Button type="button" variant="outline" size="sm" className="h-8">
                <FileUp className="mr-1.5 h-3.5 w-3.5" />
                Import CSV
              </Button>
            </span>
          </label>
        </div>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search store_id, name, market…"
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="w-fit px-2 py-0.5 text-[11px]">
          {rows.filter((r) => r.is_active).length} active
        </Badge>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background/10">
        <table className="w-full text-xs">
          <thead className="border-b border-border/60 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">store_id</th>
              <th className="px-3 py-2">store_name</th>
              <th className="px-3 py-2">market</th>
              <th className="px-3 py-2 text-right">lat</th>
              <th className="px-3 py-2 text-right">lon</th>
              <th className="px-3 py-2 text-right">status</th>
              <th className="px-3 py-2 text-right">actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No store locations found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.store_id} className="text-foreground/90">
                  <td className="px-3 py-2 font-mono">{r.store_id}</td>
                  <td className="px-3 py-2">{r.store_name ?? "—"}</td>
                  <td className="px-3 py-2">{r.market ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.lat.toFixed(5)}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.lon.toFixed(5)}</td>
                  <td className="px-3 py-2 text-right">
                    <Badge
                      variant={r.is_active ? "accent" : "outline"}
                      className="px-2 py-0.5 text-[11px]"
                    >
                      {r.is_active ? "active" : "inactive"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => {
                          setForm({
                            store_id: r.store_id,
                            store_name: r.store_name ?? "",
                            market: r.market ?? "",
                            lat: String(r.lat),
                            lon: String(r.lon),
                            is_active: r.is_active,
                          });
                          setEditStoreId(r.store_id);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={async () => {
                          const ok = window.confirm(
                            r.is_active
                              ? `Deactivate ${r.store_id}?`
                              : `This store is already inactive.`,
                          );
                          if (!ok || !r.is_active) return;
                          const resp = await fetch(
                            `/api/admin/sfs-store-locations?store_id=${encodeURIComponent(r.store_id)}`,
                            { method: "DELETE" },
                          );
                          const out = await resp.json().catch(() => null);
                          if (!resp.ok) {
                            toast.error(out?.error ?? "Failed to deactivate store");
                            return;
                          }
                          toast.success("Deactivated");
                          await refresh();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(v) => (!saving ? setOpen(v) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.store_id ? "Edit store location" : "Add store location"}</DialogTitle>
            <DialogDescription>Coordinates are required for distance computation.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">store_id</Label>
              <Input
                value={form.store_id}
                disabled={saving || !!editStoreId}
                onChange={(e) => setForm((p) => ({ ...p, store_id: e.target.value }))}
                placeholder="e.g. CHI_ANCHOR_001"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Status</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={form.is_active ? "secondary" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => setForm((p) => ({ ...p, is_active: true }))}
                  disabled={saving}
                >
                  Active
                </Button>
                <Button
                  type="button"
                  variant={!form.is_active ? "secondary" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => setForm((p) => ({ ...p, is_active: false }))}
                  disabled={saving}
                >
                  Inactive
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">store_name</Label>
              <Input
                value={form.store_name}
                disabled={saving}
                onChange={(e) => setForm((p) => ({ ...p, store_name: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">market</Label>
              <Input
                value={form.market}
                disabled={saving}
                onChange={(e) => setForm((p) => ({ ...p, market: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">lat</Label>
              <Input
                value={form.lat}
                disabled={saving}
                onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
                placeholder="e.g. 41.8781"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">lon</Label>
              <Input
                value={form.lon}
                disabled={saving}
                onChange={(e) => setForm((p) => ({ ...p, lon: e.target.value }))}
                placeholder="e.g. -87.6298"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={async () => {
                const store_id = form.store_id.trim();
                const lat = Number(form.lat);
                const lon = Number(form.lon);
                if (!store_id) {
                  toast.error("store_id is required");
                  return;
                }
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                  toast.error("lat and lon must be valid numbers");
                  return;
                }
                setSaving(true);
                try {
                  const resp = await fetch("/api/admin/sfs-store-locations", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      store_id,
                      store_name: form.store_name.trim() ? form.store_name.trim() : null,
                      market: form.market.trim() ? form.market.trim() : null,
                      lat,
                      lon,
                      is_active: form.is_active,
                    }),
                  });
                  const out = await resp.json().catch(() => null);
                  if (!resp.ok) {
                    toast.error(out?.error ?? "Failed to save store");
                    return;
                  }
                  toast.success("Saved");
                  setOpen(false);
                  await refresh();
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentPanel>
  );
}
