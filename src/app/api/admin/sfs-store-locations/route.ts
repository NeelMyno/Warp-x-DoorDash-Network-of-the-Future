import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SfsStoreLocationsBatchSchema, SfsStoreLocationUpsertSchema } from "@/lib/sfs-calculator/validate";

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
    .from("sfs_store_locations")
    .select("store_id, store_name, market, lat, lon, is_active, created_at, updated_at")
    .order("store_id");

  if (error) {
    return NextResponse.json({ error: "Failed to load store locations" }, { status: 500 });
  }

  return NextResponse.json({ locations: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = SfsStoreLocationsBatchSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json({ error: first?.message ?? "Validation failed" }, { status: 400 });
    }

    const rows = parsed.data.locations.map((l) => ({
      store_id: l.store_id,
      store_name: l.store_name ?? null,
      market: l.market ?? null,
      lat: l.lat,
      lon: l.lon,
      is_active: typeof l.is_active === "boolean" ? l.is_active : true,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await auth.supabase
      .from("sfs_store_locations")
      .upsert(rows, { onConflict: "store_id" })
      .select("store_id, store_name, market, lat, lon, is_active, created_at, updated_at");

    if (error) {
      return NextResponse.json({ error: "Failed to save store locations" }, { status: 500 });
    }

    revalidatePath("/m/sfs");
    revalidatePath("/admin");

    return NextResponse.json({ ok: true, locations: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = SfsStoreLocationUpsertSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json({ error: first?.message ?? "Validation failed" }, { status: 400 });
    }

    const row = parsed.data;
    const { data, error } = await auth.supabase
      .from("sfs_store_locations")
      .upsert(
        {
          store_id: row.store_id,
          store_name: row.store_name ?? null,
          market: row.market ?? null,
          lat: row.lat,
          lon: row.lon,
          is_active: typeof row.is_active === "boolean" ? row.is_active : true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" },
      )
      .select("store_id, store_name, market, lat, lon, is_active, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to save store location" }, { status: 500 });
    }

    revalidatePath("/m/sfs");
    revalidatePath("/admin");

    return NextResponse.json({ ok: true, location: data });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const storeId = (searchParams.get("store_id") ?? "").trim();
  if (!storeId) {
    return NextResponse.json({ error: "store_id is required" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("sfs_store_locations")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("store_id", storeId);

  if (error) {
    return NextResponse.json({ error: "Failed to deactivate store location" }, { status: 500 });
  }

  revalidatePath("/m/sfs");
  revalidatePath("/admin");

  return NextResponse.json({ ok: true });
}
