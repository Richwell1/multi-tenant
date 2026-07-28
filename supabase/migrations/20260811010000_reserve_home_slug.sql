-- ===========================================================================
-- Reserve the 'home' slug.
--
-- Cloudflare Workers deployment moves the marketing/login/register/admin
-- surface to home.<domain> (the bare apex is owned by an unrelated site), and
-- every other subdomain becomes a live tenant workspace via wildcard DNS. A
-- company must never be able to claim the 'home' slug and shadow that host.
--
-- Mirrors the addition of 'home' to RESERVED_SLUGS in src/lib/slug.ts and
-- supabase/functions/register-company/index.ts. Keep all three in sync.
-- ===========================================================================

create or replace function public.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(coalesce(p_slug, '')) = any (array[
    'admin','api','auth','login','logout','register','dashboard','settings',
    'support','system','platform','www','home','health','packages','updates',
    'extensions','marketplace'
  ]);
$$;
