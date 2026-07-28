-- ===========================================================================
-- Make the public slug-availability check actually callable before sign-in.
--
-- `is_slug_available` is granted to `anon` (20260801010000) and is used by the
-- REGISTRATION form — necessarily before the visitor has any session. But it was
-- not SECURITY DEFINER, so it executed as the caller and its
-- `select 1 from public.companies` hit table privileges that `anon` does not
-- have:
--
--   401 / 42501  permission denied for table companies
--
-- The EXECUTE grant was therefore useless: every anonymous call failed, so the
-- registration form could never tell "taken" from "available" and fell back to
-- a neutral hint.
--
-- SECURITY DEFINER is safe here and is the minimum needed:
--   * the function returns a single BOOLEAN — never a company row, id, name,
--     email, or count, so it cannot be used to enumerate tenants beyond the
--     yes/no a registration form must reveal anyway;
--   * `search_path = ''` is retained, so every reference stays fully qualified
--     and cannot be hijacked by a caller-controlled search path;
--   * no new table privileges are granted to `anon` — the point of doing this
--     with a definer function instead of `GRANT SELECT ON public.companies`.
--
-- Availability remains UX only. The authoritative uniqueness guarantee is still
-- the unique index on companies.slug plus the collision-safe allocation inside
-- register_company, which is what makes two simultaneous submissions safe.
-- ===========================================================================

create or replace function public.is_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p_slug, '') ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(coalesce(p_slug, '')) between 3 and 63
    and not public.is_reserved_slug(p_slug)
    and not exists (select 1 from public.companies c where c.slug = lower(p_slug));
$$;

-- Re-assert the intended privileges: callable by the public registration form,
-- and by nobody else implicitly.
revoke execute on function public.is_slug_available(text) from public;
grant execute on function public.is_slug_available(text) to anon, authenticated;

-- `is_reserved_slug` is consulted through the definer function above, so it
-- needs no grant of its own; keep it off the public API surface.
revoke execute on function public.is_reserved_slug(text) from public, anon;
