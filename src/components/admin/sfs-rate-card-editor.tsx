"use client";

import * as React from "react";
import { Pencil, Plus, Trash2, X, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ContentPanel } from "@/components/panels/ContentPanel";
import type { SfsRateCard, VehicleType } from "@/lib/sfs-calculator/types";

interface Props {
  rateCards: SfsRateCard[];
}

const VEHICLE_OPTIONS = [
  { value: "Cargo Van", label: "Cargo Van" },
  { value: "Box Truck", label: "Box Truck" },
];

interface EditingRow {
  id: string | null; // null = new row
  market: string;
  vehicle_type: VehicleType;
  base_cost: string;
  cost_per_mile: string;
  stop_fee: string;
  driver_cost: string;
}

export function SfsRateCardEditor({ rateCards: initialCards }: Props) {
  const [cards, setCards] = React.useState<SfsRateCard[]>(initialCards);
  const [editing, setEditing] = React.useState<EditingRow | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const startAdd = () => {
    setEditing({
      id: null,
      market: "",
      vehicle_type: "Cargo Van",
      base_cost: "0",
      cost_per_mile: "0",
      stop_fee: "0",
      driver_cost: "0",
    });
    setError(null);
  };

  const startEdit = (card: SfsRateCard) => {
    setEditing({
      id: card.id,
      market: card.market,
      vehicle_type: card.vehicle_type,
      base_cost: String(card.base_cost),
      cost_per_mile: String(card.cost_per_mile),
      stop_fee: String(card.stop_fee),
      driver_cost: String(card.driver_cost),
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    const { id, market, vehicle_type, base_cost, cost_per_mile, stop_fee, driver_cost } = editing;

    if (!market.trim()) {
      setError("Market is required");
      return;
    }

    const parsed = {
      market: market.trim(),
      vehicle_type,
      base_cost: parseFloat(base_cost) || 0,
      cost_per_mile: parseFloat(cost_per_mile) || 0,
      stop_fee: parseFloat(stop_fee) || 0,
      driver_cost: parseFloat(driver_cost) || 0,
    };

    if (parsed.cost_per_mile < 0 || parsed.driver_cost < 0 || parsed.base_cost < 0 || parsed.stop_fee < 0) {
      setError("Values cannot be negative");
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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }

      const saved = await res.json();
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
    if (!confirm("Delete this rate card?")) return;
    setDeleting(id);

    try {
      const res = await fetch(`/api/admin/sfs-rate-cards?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <ContentPanel
      title="SFS Rate Cards"
      description="Manage rate cards for the SFS Route Economics Calculator."
      right={
        <Button size="sm" variant="outline" onClick={startAdd} disabled={!!editing}>
          <Plus className="mr-1.5 h-3 w-3" />
          Add
        </Button>
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3">Market</th>
              <th className="pb-2 pr-3">Vehicle</th>
              <th className="pb-2 pr-3 text-right">Base Cost</th>
              <th className="pb-2 pr-3 text-right">$/Mile</th>
              <th className="pb-2 pr-3 text-right">Stop Fee</th>
              <th className="pb-2 pr-3 text-right">Driver Cost</th>
              <th className="pb-2 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {/* Add/Edit row */}
            {editing && (
              <tr className="bg-muted/20">
                <td className="py-2 pr-2">
                  <Input
                    value={editing.market}
                    onChange={(e) => setEditing({ ...editing, market: e.target.value })}
                    placeholder="e.g. Chicago"
                    className="h-8 text-sm"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Select
                    value={editing.vehicle_type}
                    onChange={(e) => setEditing({ ...editing, vehicle_type: e.target.value as VehicleType })}
                    options={VEHICLE_OPTIONS}
                    className="h-8 text-sm"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input type="number" min="0" step="0.01" value={editing.base_cost}
                    onChange={(e) => setEditing({ ...editing, base_cost: e.target.value })}
                    className="h-8 w-20 text-right text-sm" />
                </td>
                <td className="py-2 pr-2">
                  <Input type="number" min="0" step="0.01" value={editing.cost_per_mile}
                    onChange={(e) => setEditing({ ...editing, cost_per_mile: e.target.value })}
                    className="h-8 w-20 text-right text-sm" />
                </td>
                <td className="py-2 pr-2">
                  <Input type="number" min="0" step="0.01" value={editing.stop_fee}
                    onChange={(e) => setEditing({ ...editing, stop_fee: e.target.value })}
                    className="h-8 w-20 text-right text-sm" />
                </td>
                <td className="py-2 pr-2">
                  <Input type="number" min="0" step="0.01" value={editing.driver_cost}
                    onChange={(e) => setEditing({ ...editing, driver_cost: e.target.value })}
                    className="h-8 w-20 text-right text-sm" />
                </td>
                <td className="py-2">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} disabled={saving}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {/* Existing rows */}
            {cards.map((card) => (
              <tr key={card.id} className={editing?.id === card.id ? "hidden" : ""}>
                <td className="py-2 pr-3 font-medium">{card.market}</td>
                <td className="py-2 pr-3">{card.vehicle_type}</td>
                <td className="py-2 pr-3 text-right font-mono">${card.base_cost.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right font-mono">${card.cost_per_mile.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right font-mono">${card.stop_fee.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right font-mono">${card.driver_cost.toFixed(2)}</td>
                <td className="py-2">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(card)} disabled={!!editing}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(card.id)} disabled={deleting === card.id || !!editing}>
                      {deleting === card.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {cards.length === 0 && !editing && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted-foreground">
                  No rate cards configured. Click &ldquo;Add&rdquo; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ContentPanel>
  );
}

