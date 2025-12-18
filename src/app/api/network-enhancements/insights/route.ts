import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getNetworkEnhancementsInsights } from "@/lib/network-enhancements/get-insights";

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
  const viewId = searchParams.get("viewId");

  const result = await getNetworkEnhancementsInsights({
    viewId: viewId ?? "",
    supabase,
  });

  if (!result.ok) {
    const status = result.error === "Invalid viewId." ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.insights, { headers: { "Cache-Control": "no-store" } });
}

