-- Warp x DoorDash: Network of the Future Portal (V1)
-- Destructive simplification: remove "draft" module content workflow.
--
-- After this migration:
-- - `public.module_sections` contains ONE canonical row per (module_slug, section_key)
-- - any admin save is immediately live ("published")
-- - draft/published columns, policies, and views are removed

create extension if not exists "pgcrypto" with schema extensions;

-- 1) Collapse module_sections to a single canonical row per section.
do $$
begin
  if to_regclass('public.module_sections') is null then
    raise notice 'public.module_sections does not exist; skipping.';
    return;
  end if;

  -- If the legacy `status` column exists, remove draft rows when a published row exists
  -- for the same module+section (published wins). If there is no published row, the
  -- draft row is kept (prevents content loss).
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'module_sections'
      and column_name = 'status'
  ) then
    delete from public.module_sections d
    using public.module_sections p
    where d.module_slug = p.module_slug
      and d.section_key = p.section_key
      and d.status = 'draft'
      and p.status = 'published';
  end if;

  execute 'drop view if exists public.published_module_sections';

  -- Drop legacy policies (names from previous iterations).
  execute 'drop policy if exists "Published module sections are readable" on public.module_sections';
  execute 'drop policy if exists "Admins can read module section drafts" on public.module_sections';
  execute 'drop policy if exists "Module sections are readable" on public.module_sections';

  -- Drop legacy constraints/indexes before dropping columns.
  execute 'alter table public.module_sections drop constraint if exists module_sections_status_check';
  execute 'alter table public.module_sections drop constraint if exists module_sections_unique';
  execute 'drop index if exists module_sections_lookup_idx';

  -- Remove legacy columns (safe if already removed).
  execute 'alter table public.module_sections drop column if exists status';
  execute 'alter table public.module_sections drop column if exists published_at';

  -- Canonical uniqueness per module section.
  execute 'alter table public.module_sections add constraint module_sections_unique unique (module_slug, section_key)';

  execute 'create index if not exists module_sections_lookup_idx on public.module_sections (module_slug, section_key)';

  -- Ensure updated_at is maintained.
  execute $sql$
    create or replace function public.handle_module_sections_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  $sql$;

  execute 'drop trigger if exists on_module_sections_updated_at on public.module_sections';
  execute 'create trigger on_module_sections_updated_at before update on public.module_sections for each row execute function public.handle_module_sections_updated_at()';

  execute 'alter table public.module_sections enable row level security';

  -- Recreate select policy. Prefer portal membership gating if available.
  if to_regprocedure('public.is_portal_member()') is not null then
    execute 'create policy "Module sections are readable" on public.module_sections for select to authenticated using (public.is_portal_member())';
  else
    execute 'create policy "Module sections are readable" on public.module_sections for select to authenticated using (true)';
  end if;

  -- Admin write policies.
  execute 'drop policy if exists "Admins can insert module sections" on public.module_sections';
  execute 'create policy "Admins can insert module sections" on public.module_sections for insert to authenticated with check (public.is_admin())';

  execute 'drop policy if exists "Admins can update module sections" on public.module_sections';
  execute 'create policy "Admins can update module sections" on public.module_sections for update to authenticated using (public.is_admin()) with check (public.is_admin())';

  execute 'drop policy if exists "Admins can delete module sections" on public.module_sections';
  execute 'create policy "Admins can delete module sections" on public.module_sections for delete to authenticated using (public.is_admin())';
end $$;

-- 2) module_section_audit: remove draft/published status and consolidate actions.
do $$
begin
  if to_regclass('public.module_section_audit') is null then
    raise notice 'public.module_section_audit does not exist; skipping.';
    return;
  end if;

  -- Drop constraints that referenced draft/published enums.
  execute 'alter table public.module_section_audit drop constraint if exists module_section_audit_action_check';
  execute 'alter table public.module_section_audit drop constraint if exists module_section_audit_status_check';

  -- Normalize historical actions to the single supported event type.
  execute $sql$
    update public.module_section_audit
    set action = 'module_content_updated'
    where action is distinct from 'module_content_updated';
  $sql$;

  execute 'alter table public.module_section_audit drop column if exists status';

  execute $sql$
    alter table public.module_section_audit
      add constraint module_section_audit_action_check
      check (action in ('module_content_updated'));
  $sql$;
end $$;

