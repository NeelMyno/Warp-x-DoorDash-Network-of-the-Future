import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RateCardSchema, RateCardUpdateSchema } from "@/lib/sfs-calculator/validate";
import type { User } from "@supabase/supabase-js";

type SfsRateCardAuditAction =
  | "sfs_rate_card_created"
  | "sfs_rate_card_updated"
  | "sfs_rate_card_deleted";

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

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  action: SfsRateCardAuditAction,
  metadata: Record<string, unknown>
) {
  try {
    await supabase.from("user_admin_audit").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action,
      target_user_id: null,
      target_email: null,
      metadata,
    });
  } catch (err) {
    console.error(`[sfs-rate-cards] Failed to write ${action} audit:`, err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();

    // Validate with zod
    const parsed = RateCardSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    const { vehicle_type, base_fee, per_mile_rate, per_stop_rate } = parsed.data;

    const { data, error } = await auth.supabase
      .from("sfs_rate_cards")
      .insert({
        vehicle_type,
        base_fee,
        per_mile_rate,
        per_stop_rate,
      })
      .select()
      .single();

    if (error) {
      console.error("[sfs-rate-cards] Insert error:", error.code, error.message);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Rate card already exists for this vehicle type" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to create rate card" }, { status: 500 });
    }

    // Audit log
    await writeAudit(auth.supabase, auth.user, "sfs_rate_card_created", {
      rate_card_id: data.id,
      vehicle_type,
    });

    // Revalidate SFS module page so calculator shows fresh data
    revalidatePath("/m/sfs");

    return NextResponse.json(data);
  } catch (err) {
    console.error("[sfs-rate-cards] POST error:", err);
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

    // Validate with zod
    const parsed = RateCardUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    const { id, vehicle_type, base_fee, per_mile_rate, per_stop_rate } = parsed.data;

    const { data, error } = await auth.supabase
      .from("sfs_rate_cards")
      .update({
        vehicle_type,
        base_fee,
        per_mile_rate,
        per_stop_rate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[sfs-rate-cards] Update error:", error.code, error.message);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Rate card already exists for this vehicle type" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to update rate card" }, { status: 500 });
    }

    // Audit log
    await writeAudit(auth.supabase, auth.user, "sfs_rate_card_updated", {
      rate_card_id: id,
      vehicle_type,
    });

    // Revalidate SFS module page so calculator shows fresh data
    revalidatePath("/m/sfs");

    return NextResponse.json(data);
  } catch (err) {
    console.error("[sfs-rate-cards] PATCH error:", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Guardrail: never allow deleting the last remaining rate card.
  try {
    const { count, error: countError } = await auth.supabase
      .from("sfs_rate_cards")
      .select("id", { count: "exact", head: true });
    if (!countError && typeof count === "number" && count <= 1) {
      return NextResponse.json({ error: "At least one rate card must remain" }, { status: 409 });
    }
  } catch {
    // Best-effort: if count fails, proceed and let the delete fail naturally.
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: "Invalid rate card ID" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("sfs_rate_cards")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[sfs-rate-cards] Delete error:", error.code, error.message);
    return NextResponse.json({ error: "Failed to delete rate card" }, { status: 500 });
  }

  // Audit log
  await writeAudit(auth.supabase, auth.user, "sfs_rate_card_deleted", {
    rate_card_id: id,
  });

  // Revalidate SFS module page so calculator shows fresh data
  revalidatePath("/m/sfs");

  return NextResponse.json({ success: true });
}
