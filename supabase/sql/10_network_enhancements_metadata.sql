-- Warp x DoorDash: Network of the Future Portal (V1)
-- Network enhancements metadata fields (diagram/pdf titles + captions + alt text)

alter table if exists public.network_enhancements_views
  add column if not exists diagram_title text null,
  add column if not exists diagram_alt text null,
  add column if not exists diagram_caption text null,
  add column if not exists pdf_title text null,
  add column if not exists pdf_caption text null;

