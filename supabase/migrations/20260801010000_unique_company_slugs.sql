-- ---------------------------------------------------------------------------
-- Globally unique company slugs for path-based tenant routing.
--
-- companies.slug is already `not null unique` (constraint companies_slug_key).
-- This migration:
--   * hardens the slug FORMAT (lowercase, URL-safe, length 3..63, non-reserved)
--   * adds a reserved-word predicate mirrored by src/lib/slug.ts
--   * makes the BACKEND authoritative for collision-safe slug generation via
--     public.register_company(...) with bounded random-suffix retry
--   * exposes public.is_slug_available(...) for pre-submit UX (boolean only —
--     never leaks company rows)
--
-- The company UUID remains the tenant identity + security boundary. The slug is
-- only a public routing identifier. RLS is unchanged.
-- ---------------------------------------------------------------------------

-- 1) Reserved-slug predicate. AUTHORITATIVE list — mirrored verbatim by the
--    RESERVED_SLUGS constant in src/lib/slug.ts. Keep the two in sync.
create or replace function public.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(coalesce(p_slug, '')) = any (array[
    'admin','api','auth','login','logout','register','dashboard','settings',
    'support','system','platform','www','health','packages','updates',
    'extensions','marketplace'
  ]);
$$;

-- 2) Normalize free text (a company name) into a base slug candidate.
create or replace function public.slugify(p_input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    left(
      regexp_replace(
        regexp_replace(lower(coalesce(p_input, '')), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)', '', 'g'
      ),
      63),
    '-+$', ''  -- re-trim if truncation to 63 left a trailing hyphen
  );
$$;

-- 3) Availability check for pre-submit UX. Returns a boolean ONLY — no company
--    data is exposed. Reserved/invalid slugs report unavailable.
create or replace function public.is_slug_available(p_slug text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    coalesce(p_slug, '') ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(coalesce(p_slug, '')) between 3 and 63
    and not public.is_reserved_slug(p_slug)
    and not exists (select 1 from public.companies c where c.slug = lower(p_slug));
$$;
grant execute on function public.is_slug_available(text) to anon, authenticated;

-- 4) Defensive backfill: normalize any pre-existing row that would violate the
--    new rules (there are none in the seed). Deterministic + collision-safe; no
--    hardcoded slugs or identities.
do $$
declare
  r record;
  base text;
  cand text;
  n int;
begin
  for r in select id, name, slug from public.companies loop
    if r.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       and char_length(r.slug) between 3 and 63
       and not public.is_reserved_slug(r.slug) then
      continue; -- already valid
    end if;
    base := public.slugify(r.name);
    if base is null or char_length(base) < 3 then
      base := 'company';
    end if;
    cand := base;
    n := 0;
    while public.is_reserved_slug(cand)
       or exists (select 1 from public.companies c where c.slug = cand and c.id <> r.id) loop
      n := n + 1;
      cand := left(base, 58) || '-' || substr(md5(random()::text), 1, 4);
      if n > 20 then
        raise exception 'backfill_slug_failed for company %', r.id;
      end if;
    end loop;
    update public.companies set slug = cand where id = r.id;
  end loop;
end $$;

-- 5) Format / case / length / reserved CHECK constraints (idempotent add).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_slug_lowercase_ck') then
    alter table public.companies add constraint companies_slug_lowercase_ck check (slug = lower(slug));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_slug_format_ck') then
    alter table public.companies add constraint companies_slug_format_ck check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_slug_length_ck') then
    alter table public.companies add constraint companies_slug_length_ck check (char_length(slug) between 3 and 63);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_slug_not_reserved_ck') then
    alter table public.companies add constraint companies_slug_not_reserved_ck check (not public.is_reserved_slug(slug));
  end if;
end $$;
-- companies.slug is already UNIQUE via companies_slug_key — NOT duplicated here.

-- 6) Authoritative, collision-safe registration entry point. Wraps the existing
--    onboard_company insert; the backend owns the final slug. Two modes:
--      * requested slug  -> validate strictly, never auto-suffix; conflict is a
--                           clean duplicate_slug (surfaced as "already taken")
--      * auto (no slug)  -> slugify(name), then retry with a random suffix on
--                           collision up to a strict limit (race-safe)
create or replace function public.register_company(
  p_user_id        uuid,
  p_company_name   text,
  p_requested_slug text default null,
  p_company_email  text default null,
  p_phone          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base    text;
  v_cand    text;
  v_attempt int := 0;
  v_max     constant int := 5;
  v_requested boolean := coalesce(nullif(trim(coalesce(p_requested_slug, '')), ''), '') <> '';
begin
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'invalid_company_name' using errcode = '22023';
  end if;

  -- User-chosen workspace URL: validate strictly, never rewrite it silently.
  if v_requested then
    v_base := lower(trim(p_requested_slug));
    if v_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_base) not between 3 and 63 then
      raise exception 'invalid_slug' using errcode = '22023';
    end if;
    if public.is_reserved_slug(v_base) then
      raise exception 'reserved_slug' using errcode = '22023';
    end if;
    begin
      return public.onboard_company(p_user_id, p_company_name, v_base, v_base, p_company_email, p_phone);
    exception when unique_violation then
      -- Pre-check duplicate OR insert race → one clean, safe code.
      raise exception 'duplicate_slug' using errcode = '23505';
    end;
  end if;

  -- Auto mode: derive a base from the company name (generic fallback if empty).
  v_base := public.slugify(p_company_name);
  if v_base is null or char_length(v_base) < 3 then
    v_base := 'company';
  end if;

  loop
    v_attempt := v_attempt + 1;
    if v_attempt = 1 and not public.is_reserved_slug(v_base) then
      v_cand := v_base;
    else
      -- Non-sequential, non-enumerable suffix (never rich-company-2/-3).
      v_cand := left(v_base, 58) || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    end if;

    begin
      return public.onboard_company(p_user_id, p_company_name, v_cand, v_cand, p_company_email, p_phone);
    exception when others then
      -- Retry ONLY slug/subdomain collisions; re-raise anything else
      -- (e.g. user_already_member, hr_core_unavailable) immediately.
      if sqlerrm not like '%duplicate_slug%' and sqlerrm not like '%duplicate_subdomain%'
         and sqlstate <> '23505' then
        raise;
      end if;
    end;

    if v_attempt >= v_max then
      raise exception 'slug_allocation_failed' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

-- register_company stays service_role-only (called by the register-company Edge
-- Function, which holds the service-role key). Never exposed to the browser.
revoke execute on function public.register_company(uuid, text, text, text, text) from public;
revoke execute on function public.register_company(uuid, text, text, text, text) from anon;
revoke execute on function public.register_company(uuid, text, text, text, text) from authenticated;
grant execute on function public.register_company(uuid, text, text, text, text) to service_role;
