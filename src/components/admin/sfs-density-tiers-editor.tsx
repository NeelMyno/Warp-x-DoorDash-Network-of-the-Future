"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Save, TriangleAlert } from "lucide-react";

import { ContentPanel } from "@/components/panels/ContentPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateDensityTiers } from "@/lib/sfs-calculator/density";

type TierRow = {
  id?: string;
  sort_order: number;
  min_miles: string;
  max_miles: string;
  discount_pct: string;
  label: string;
  is_active: boolean;
};

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function SfsDensityTiersEditor() {
  const [rows, setRows] = React.useState<TierRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setValidationError(null);
    try {
      const res = await fetch("/api/admin/sfs-density-tiers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to load density tiers");
        setRows([]);
        return;
      }
      const tiers = (data.tiers ?? []) as Array<{
        id?: string;
        sort_order: number;
        min_miles: number | string;
        max_miles: number | string | null;
        discount_pct: number | string;
        label: string | null;
        is_active?: boolean | null;
      }>;
      setRows(
        tiers.map((t) => ({
          id: t.id,
          sort_order: Number(t.sort_order),
          min_miles: String(t.min_miles ?? ""),
          max_miles: t.max_miles == null ? "" : String(t.max_miles),
          discount_pct: String(t.discount_pct ?? ""),
          label: String(t.label ?? ""),
          is_active: t.is_active !== false,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const validate = React.useCallback((): boolean => {
    setValidationError(null);
    const active = rows.filter((r) => r.is_active).map((r) => ({
      sortOrder: r.sort_order,
      minMiles: toNumberOrNull(r.min_miles) ?? NaN,
      maxMiles: toNumberOrNull(r.max_miles),
      discountPct: toNumberOrNull(r.discount_pct) ?? NaN,
      label: r.label || null,
    }));
    if (active.length < 3) {
      setValidationError("Create at least 3 active tiers.");
      return false;
    }
    const hasOpenEnded = active.some((t) => t.maxMiles == null);
    if (!hasOpenEnded) {
      setValidationError("Add an open-ended tier (max_miles empty) for the last band.");
      return false;
    }
    const base = validateDensityTiers(active);
    if (!base.ok) {
      setValidationError(base.reason);
      return false;
    }
    return true;
  }, [rows]);

  const handleAddTier = () => {
    setRows((prev) => [
      ...prev,
      {
        sort_order: prev.length ? Math.max(...prev.map((p) => p.sort_order)) + 1 : 1,
        min_miles: "",
        max_miles: "",
        discount_pct: "",
        label: "",
        is_active: true,
      },
    ]);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        tiers: rows.map((r) => ({
          id: r.id,
          sort_order: r.sort_order,
          min_miles: toNumberOrNull(r.min_miles) ?? 0,
          max_miles: toNumberOrNull(r.max_miles),
          discount_pct: toNumberOrNull(r.discount_pct) ?? 0,
          label: r.label.trim() ? r.label.trim() : null,
          is_active: r.is_active,
        })),
      };
      const resp = await fetch("/api/admin/sfs-density-tiers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await resp.json().catch(() => null);
      if (!resp.ok) {
        const msg = out?.error ?? "Failed to save tiers";
        setValidationError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Saved tiers");
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (idx: number, updates: Partial<TierRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx]!, ...updates };
      return next;
    });
  };

  return (
    <ContentPanel
      title="SFS Density Discount Tiers"
      description="Controls distance bands and the weighted density discount (applied only to the base portion)."
      right={
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleAddTier}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add tier
          </Button>
          <Button type="button" size="sm" className="h-8" disabled={saving || loading} onClick={handleSave}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      }
    >
      {validationError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 text-amber-500">
            <TriangleAlert className="h-4 w-4" />
            <span className="font-medium text-foreground">Validation</span>
          </div>
          <div className="mt-1">{validationError}</div>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background/10">
        <table className="w-full text-xs">
          <thead className="border-b border-border/60 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-right">Order</th>
              <th className="px-3 py-2 text-right">Min miles</th>
              <th className="px-3 py-2 text-right">Max miles</th>
              <th className="px-3 py-2 text-right">Discount %</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2 text-right">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No tiers configured.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const pct = toNumberOrNull(r.discount_pct);
                const warnHigh = typeof pct === "number" && pct > 0.2;
                return (
                  <tr key={r.id ?? idx} className="text-foreground/90">
                    <td className="px-3 py-2">
                      <Input
                        value={String(r.sort_order)}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          updateRow(idx, { sort_order: Number.isFinite(n) ? n : 0 });
                        }}
                        className="h-8 w-[86px] text-right font-mono"
                        disabled={saving}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={r.min_miles}
                        onChange={(e) => updateRow(idx, { min_miles: e.target.value })}
                        className="h-8 w-[110px] text-right font-mono"
                        disabled={saving}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={r.max_miles}
                        onChange={(e) => updateRow(idx, { max_miles: e.target.value })}
                        placeholder="(open)"
                        className="h-8 w-[110px] text-right font-mono"
                        disabled={saving}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={r.discount_pct}
                        onChange={(e) => updateRow(idx, { discount_pct: e.target.value })}
                        className="h-8 w-[110px] text-right font-mono"
                        disabled={saving}
                      />
                      {warnHigh ? (
                        <div className="mt-1 text-[10px] text-amber-500">Note: cap stays ≤20%.</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={r.label}
                        onChange={(e) => updateRow(idx, { label: e.target.value })}
                        placeholder="e.g. 0–10 mi"
                        className="h-8"
                        disabled={saving}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant={r.is_active ? "secondary" : "outline"}
                        size="sm"
                        className="h-8"
                        disabled={saving}
                        onClick={() => updateRow(idx, { is_active: !r.is_active })}
                      >
                        {r.is_active ? "Active" : "Inactive"}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
            Discount is package-weighted across satellites
          </Badge>
          <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
            Cap = min(20%, max tier discount)
          </Badge>
        </div>
      </div>
    </ContentPanel>
  );
}
