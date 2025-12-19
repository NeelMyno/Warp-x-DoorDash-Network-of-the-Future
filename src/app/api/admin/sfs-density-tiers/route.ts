import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SfsDensityTiersBatchSchema } from "@/lib/sfs-calculator/validate";
import { validateDensityTiers } from "@/lib/sfs-calculator/density";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }

  return { supabase, user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.supabase
    .from("sfs_density_discount_tiers")
    .select("id, sort_order, min_miles, max_miles, discount_pct, label, is_active, created_at, updated_at")
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: "Failed to load density tiers" }, { status: 500 });
  }

  return NextResponse.json({ tiers: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = SfsDensityTiersBatchSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json({ error: first?.message ?? "Validation failed" }, { status: 400 });
    }

    const tiers = parsed.data.tiers
      .filter((t) => t.is_active !== false)
      .map((t) => ({
        sortOrder: t.sort_order,
        minMiles: t.min_miles,
        maxMiles: typeof t.max_miles === "number" ? t.max_miles : null,
        discountPct: t.discount_pct,
        label: t.label ?? null,
      }));

    if (tiers.length === 0) {
      return NextResponse.json({ error: "At least one active tier is required" }, { status: 400 });
    }

    const validation = validateDensityTiers(tiers);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    const rows = parsed.data.tiers.map((t) => ({
      sort_order: t.sort_order,
      min_miles: t.min_miles,
      max_miles: typeof t.max_miles === "number" ? t.max_miles : null,
      discount_pct: t.discount_pct,
      label: t.label ?? null,
      is_active: typeof t.is_active === "boolean" ? t.is_active : true,
      updated_at: new Date().toISOString(),
    }));

    // Replace-all semantics keeps ordering predictable and avoids unique conflicts.
    // Validation happens before delete to reduce foot-guns.
    const { error: deleteError } = await auth.supabase
      .from("sfs_density_discount_tiers")
      .delete()
      .gte("sort_order", 0);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to update tiers" }, { status: 500 });
    }

    const { data, error: insertError } = await auth.supabase
      .from("sfs_density_discount_tiers")
      .insert(rows)
      .select("id, sort_order, min_miles, max_miles, discount_pct, label, is_active, created_at, updated_at");

    if (insertError) {
      return NextResponse.json({ error: "Failed to save tiers" }, { status: 500 });
    }

    revalidatePath("/m/sfs");
    revalidatePath("/admin");

    return NextResponse.json({ ok: true, tiers: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
