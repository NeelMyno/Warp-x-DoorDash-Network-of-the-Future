import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { PORTAL_ASSETS_BUCKET } from "@/lib/assets/constants";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId");
  const expiresIn = 3600;

  if (!assetId || !isUuid(assetId)) {
    return NextResponse.json({ error: "Invalid assetId" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("assets")
      .select("path")
      .eq("id", assetId)
      .maybeSingle();

    if (error) {
      console.error("[assets] signed-url select error:", error.message);
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const path = typeof data?.path === "string" ? data.path : null;
    if (!path) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(PORTAL_ASSETS_BUCKET)
      .createSignedUrl(path, expiresIn);

    if (signError || !signed?.signedUrl) {
      console.error("[assets] signed-url create error:", signError?.message);
      return NextResponse.json({ error: "Failed to sign URL" }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    return NextResponse.json(
      { url: signed.signedUrl, expiresAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[assets] signed-url unexpected error:", err);
    return NextResponse.json({ error: "Failed to sign URL" }, { status: 500 });
  }
}

