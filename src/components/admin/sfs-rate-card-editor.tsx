"use client";

import * as React from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ContentPanel } from "@/components/panels/ContentPanel";
import type { SfsRateCard, VehicleType } from "@/lib/sfs-calculator/types";

interface Props {
  rateCards: SfsRateCard[];
}

const VEHICLE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: "Cargo Van", label: "Cargo Van" },
  { value: "26' Box Truck", label: "26' Box Truck" },
];

type EditingRow = {
  id: string | null; // null = new row
  vehicle_type: VehicleType;
  base_fee: string;
  per_mile_rate: string;
  per_stop_rate: string;
};

function toMoneyCell(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

export function SfsRateCardEditor({ rateCards: initialCards }: Props) {
  const [cards, setCards] = React.useState<SfsRateCard[]>(initialCards);
  const [editing, setEditing] = React.useState<EditingRow | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const sortedCards = React.useMemo(
    () => [...cards].sort((a, b) => a.vehicle_type.localeCompare(b.vehicle_type)),
    [cards],
  );

  const missingVehicleTypes = React.useMemo(() => {
    const existing = new Set(cards.map((c) => c.vehicle_type));
    return VEHICLE_OPTIONS.map((o) => o.value).filter((t) => !existing.has(t));
  }, [cards]);

  const startAdd = () => {
    const vehicle_type = missingVehicleTypes[0] ?? "Cargo Van";
    setEditing({
      id: null,
      vehicle_type,
      base_fee: "0",
      per_mile_rate: "0",
      per_stop_rate: "0",
    });
    setError(null);
  };

  const startEdit = (card: SfsRateCard) => {
    setEditing({
      id: card.id,
      vehicle_type: card.vehicle_type,
      base_fee: String(card.base_fee),
      per_mile_rate: String(card.per_mile_rate),
      per_stop_rate: String(card.per_stop_rate),
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    const { id, vehicle_type, base_fee, per_mile_rate, per_stop_rate } = editing;

    const parsed = {
      vehicle_type,
      base_fee: Number(base_fee),
      per_mile_rate: Number(per_mile_rate),
      per_stop_rate: Number(per_stop_rate),
    };

    if (
      !Number.isFinite(parsed.base_fee) ||
      !Number.isFinite(parsed.per_mile_rate) ||
      !Number.isFinite(parsed.per_stop_rate)
    ) {
      setError("All values must be valid numbers.");
      return;
    }

    if (parsed.base_fee < 0 || parsed.per_mile_rate < 0 || parsed.per_stop_rate < 0) {
      setError("Values cannot be negative.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/sfs-rate-cards", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id, ...parsed } : parsed),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Failed to save");
      }

      const saved = data as SfsRateCard;
      if (id) {
        setCards((prev) => prev.map((c) => (c.id === id ? saved : c)));
      } else {
        setCards((prev) => [...prev, saved]);
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (cards.length <= 1) {
      setError("At least one rate card must remain.");
      return;
    }
    if (!confirm("Delete this rate card?")) return;
    setDeleting(id);

    try {
      const res = await fetch(`/api/admin/sfs-rate-cards?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Failed to delete");
      }
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  const addDisabled = !!editing || missingVehicleTypes.length === 0;

  return (
    <ContentPanel
      title="SFS Rate Cards"
      description="Rates for the Ship From Store Route Economics Calculator (one row per vehicle type)."
      right={
        <Button size="sm" variant="outline" onClick={startAdd} disabled={addDisabled}>
          <Plus className="mr-1.5 h-3 w-3" />
          Add
        </Button>
      }
    >
      {error ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3">Vehicle</th>
              <th className="pb-2 pr-3 text-right">Base fee</th>
              <th className="pb-2 pr-3 text-right">Per mile</th>
              <th className="pb-2 pr-3 text-right">Per stop</th>
              <th className="pb-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {editing ? (
              <tr className="bg-muted/20">
                <td className="py-2 pr-2">
                  <Select
                    value={editing.vehicle_type}
                    onChange={(e) =>
                      setEditing({ ...editing, vehicle_type: e.target.value as VehicleType })
                    }
                    options={VEHICLE_OPTIONS}
                    className="h-8 text-sm"
                    disabled={!!editing.id} // don't change vehicle_type while editing an existing row
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.base_fee}
                    onChange={(e) => setEditing({ ...editing, base_fee: e.target.value })}
                    className="h-8 w-24 text-right text-sm"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.per_mile_rate}
                    onChange={(e) => setEditing({ ...editing, per_mile_rate: e.target.value })}
                    className="h-8 w-24 text-right text-sm"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.per_stop_rate}
                    onChange={(e) => setEditing({ ...editing, per_stop_rate: e.target.value })}
                    className="h-8 w-24 text-right text-sm"
                  />
                </td>
                <td className="py-2">
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ) : null}

            {sortedCards.map((card) => (
              <tr key={card.id} className={editing?.id === card.id ? "hidden" : ""}>
                <td className="py-2 pr-3 font-medium">{card.vehicle_type}</td>
                <td className="py-2 pr-3 text-right font-mono">{toMoneyCell(card.base_fee)}</td>
                <td className="py-2 pr-3 text-right font-mono">{toMoneyCell(card.per_mile_rate)}</td>
                <td className="py-2 pr-3 text-right font-mono">{toMoneyCell(card.per_stop_rate)}</td>
                <td className="py-2">
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => startEdit(card)}
                      disabled={!!editing}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(card.id)}
                      disabled={!!editing || deleting === card.id || cards.length <= 1}
                      title={cards.length <= 1 ? "At least one rate card must remain." : undefined}
                    >
                      {deleting === card.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {sortedCards.length === 0 && !editing ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  No rate cards configured. Run `supabase/sql/05_sfs_rate_cards.sql` and refresh.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </ContentPanel>
  );
}

