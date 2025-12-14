"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/browser";
import { PORTAL_ASSETS_BUCKET } from "@/lib/assets/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentPanel } from "@/components/panels/ContentPanel";

type AssetRow = {
  id: string;
  path: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  notes: string | null;
};

type PickedAsset = AssetRow & { previewUrl?: string | null };

function monthKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function splitExt(filename: string) {
  const idx = filename.lastIndexOf(".");
  if (idx <= 0 || idx === filename.length - 1) return { base: filename, ext: "" };
  return { base: filename.slice(0, idx), ext: filename.slice(idx + 1) };
}

function sanitizeBase(base: string) {
  const normalized = base
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return normalized.slice(0, 60) || "asset";
}

function buildStoragePath(input: {
  filename: string;
  moduleSlug?: string;
}) {
  const prefix = input.moduleSlug?.trim() ? input.moduleSlug.trim() : "shared";
  const { base, ext } = splitExt(input.filename);
  const safeBase = sanitizeBase(base);
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  const safeExt = ext ? ext.toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
  return `${prefix}/${monthKey()}/${safeBase}-${random}.${safeExt}`;
}

function isImageContentType(type: string | null) {
  return typeof type === "string" && type.startsWith("image/");
}

async function signUrl(path: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(PORTAL_ASSETS_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

async function fileToMetadata(file: File) {
  return {
    filename: file.name,
    content_type: file.type || null,
    size_bytes: file.size,
  };
}

export function AssetPickerDialog({
  open,
  onOpenChange,
  moduleSlug,
  imagesOnly,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleSlug?: string;
  imagesOnly?: boolean;
  onSelect: (asset: PickedAsset) => void;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [query, setQuery] = React.useState("");
  const [assets, setAssets] = React.useState<Array<PickedAsset>>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");

  const selected = assets.find((a) => a.id === selectedId) ?? null;

  async function refresh(nextQuery = query) {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("assets")
        .select("id, path, filename, content_type, size_bytes, uploaded_at, notes")
        .order("uploaded_at", { ascending: false })
        .limit(60);

      if (imagesOnly) {
        q = q.ilike("content_type", "image/%");
      }

      const trimmed = nextQuery.trim();
      if (trimmed) {
        q = q.ilike("filename", `%${trimmed}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as AssetRow[];

      const withPreview: PickedAsset[] = await Promise.all(
        rows.map(async (row, idx) => {
          if (!isImageContentType(row.content_type)) return row;
          // Keep initial load snappy: sign only the first ~24 images.
          if (idx >= 24) return row;
          const previewUrl = await signUrl(row.path);
          return { ...row, previewUrl };
        }),
      );

      setAssets(withPreview);
      if (selectedId && !withPreview.some((a) => a.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => refresh(query), 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Not authenticated.");

      const path = buildStoragePath({ filename: file.name, moduleSlug });

      const upload = await supabase.storage
        .from(PORTAL_ASSETS_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
      if (upload.error) throw upload.error;

      const meta = await fileToMetadata(file);
      const { data, error } = await supabase
        .from("assets")
        .insert({
          path,
          filename: meta.filename,
          content_type: meta.content_type,
          size_bytes: meta.size_bytes,
          uploaded_by: user.id,
          notes: notes.trim() ? notes.trim() : null,
        })
        .select("id, path, filename, content_type, size_bytes, uploaded_at, notes")
        .single();

      if (error || !data) throw error ?? new Error("Failed to index asset.");

      const inserted = data as AssetRow;
      const previewUrl = isImageContentType(inserted.content_type)
        ? await signUrl(inserted.path)
        : null;
      const picked: PickedAsset = { ...inserted, previewUrl };

      setAssets((prev) => [picked, ...prev]);
      setSelectedId(picked.id);
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Asset picker</DialogTitle>
          <DialogDescription>
            Upload once, reuse across modules. Bucket is private; assets render via signed URLs.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 grid gap-4 lg:grid-cols-[360px_1fr]">
          <ContentPanel
            title="Upload"
            description={
              moduleSlug
                ? `Default folder: ${moduleSlug}/${monthKey()}`
                : `Default folder: shared/${monthKey()}`
            }
          >
            <div className="space-y-3">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Notes (optional)
                </label>
                <Textarea
                  className="min-h-[90px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What is this asset for?"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button asChild type="button" variant="outline" disabled={uploading}>
                  <label className="cursor-pointer">
                    {uploading ? "Uploading…" : "Choose file"}
                    <input
                      type="file"
                      accept={imagesOnly ? "image/*" : undefined}
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void handleUpload(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </Button>

                <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                  Private bucket
                </Badge>
              </div>

              {error ? (
                <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {error}
                </div>
              ) : null}

              {selected ? (
                <div className="rounded-2xl border border-border bg-background/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {selected.filename}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {selected.path}
                      </div>
                    </div>
                    {isImageContentType(selected.content_type) ? (
                      <Badge variant="accent" className="px-2 py-0.5 text-[11px]">
                        image
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="px-2 py-0.5 text-[11px]">
                        file
                      </Badge>
                    )}
                  </div>

                  {selected.previewUrl ? (
                    <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-background/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selected.previewUrl}
                        alt={selected.filename}
                        className="block h-auto w-full max-h-[240px] object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                  Select an asset to preview it here.
                </div>
              )}
            </div>
          </ContentPanel>

          <ContentPanel
            title="Library"
            description="Browse and search uploaded assets."
            right={
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                  {assets.length}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => refresh()}
                >
                  Refresh
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by filename…"
              />

              <div className="max-h-[520px] overflow-auto pr-2">
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : assets.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {assets.map((asset) => {
                      const active = asset.id === selectedId;
                      const isImage = isImageContentType(asset.content_type);
                      const thumb = asset.previewUrl;

                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={async () => {
                            setSelectedId(asset.id);
                            if (isImage && !thumb) {
                              const previewUrl = await signUrl(asset.path);
                              setAssets((prev) =>
                                prev.map((a) =>
                                  a.id === asset.id ? { ...a, previewUrl } : a,
                                ),
                              );
                            }
                          }}
                          className={cn(
                            "group rounded-2xl border p-2 text-left transition",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            active
                              ? "border-primary/30 bg-primary/5 shadow-[var(--warp-shadow-elev-2)]"
                              : "border-border bg-background/15 hover:border-[color:var(--warp-border-hover)] hover:bg-background/25",
                          )}
                        >
                          <div
                            className={cn(
                              "overflow-hidden rounded-xl border border-border/70 bg-background/20",
                              isImage ? "aspect-[4/3]" : "aspect-[4/3]",
                            )}
                          >
                            {thumb ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={thumb}
                                  alt={asset.filename}
                                  className="h-full w-full object-cover"
                                />
                              </>
                            ) : (
                              <div className="grid h-full place-items-center">
                                <div className="text-[11px] text-muted-foreground">
                                  {isImage ? "Preview" : "File"}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="mt-2">
                            <div className="truncate text-xs font-medium text-foreground">
                              {asset.filename}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {asset.path}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No assets yet.
                  </div>
                )}
              </div>
            </div>
          </ContentPanel>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              if (imagesOnly && !isImageContentType(selected.content_type)) {
                setError("Select an image asset (PNG/JPG/SVG/etc.).");
                return;
              }
              onSelect(selected);
              onOpenChange(false);
            }}
          >
            Use asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
