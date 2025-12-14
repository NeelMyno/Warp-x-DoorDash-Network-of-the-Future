import { createClient } from "@/lib/supabase/server";
import { PORTAL_ASSETS_BUCKET } from "@/lib/assets/constants";

export async function getSignedAssetUrl(input: {
  assetId?: string;
  path?: string;
  expiresIn?: number;
  supabase?: Awaited<ReturnType<typeof createClient>>;
}): Promise<{ url: string | null; path: string | null }> {
  const supabase = input.supabase ?? (await createClient());

  const expiresIn = typeof input.expiresIn === "number" ? input.expiresIn : 3600;

  let path = input.path ?? null;

  if (input.assetId) {
    const { data, error } = await supabase
      .from("assets")
      .select("path")
      .eq("id", input.assetId)
      .maybeSingle();

    if (!error && data?.path) path = data.path as string;
  }

  if (!path) return { url: null, path: null };

  const { data, error } = await supabase.storage
    .from(PORTAL_ASSETS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) return { url: null, path };
  return { url: data.signedUrl, path };
}
