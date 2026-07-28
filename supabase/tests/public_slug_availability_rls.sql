-- =============================================================================
-- Public slug availability — callable before sign-in, without widening access.
--
-- Regression cover for the registration failure: `is_slug_available` was granted
-- to `anon` but was NOT SECURITY DEFINER, so every anonymous call died with
-- 401/42501 "permission denied for table companies" and the registration form
-- could never distinguish taken from available.
--
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres < supabase/tests/public_slug_availability_rls.sql
--
-- A clean run ends with 11 "ok:" lines.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

-- Evaluate as the anonymous PostgREST role, which is how the registration form
-- calls this: no JWT subject at all.
create or replace function pg_temp.as_anon(p_slug text) returns boolean
language plpgsql as $$
declare v boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  select public.is_slug_available(p_slug) into v;
  execute 'reset role';
  return v;
end; $$;

create or replace function pg_temp.anon_company_rows() returns int
language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  select count(*) into n from public.companies;
  execute 'reset role';
  return n;
end; $$;

insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'Taken Co', 'taken-co', 'active');

-- ---------------------------------------------------------------------------
-- 1-4. The function definition itself — what the outage was actually about.
-- ---------------------------------------------------------------------------
select pg_temp.check(1, 'is_slug_available is SECURITY DEFINER (or anon cannot reach companies)',
  (select prosecdef from pg_proc where proname = 'is_slug_available'));

select pg_temp.check(2, 'its search_path is pinned, so definer rights cannot be hijacked',
  (select proconfig::text like '%search_path=%'
     from pg_proc where proname = 'is_slug_available'));

select pg_temp.check(3, 'anon holds EXECUTE (the registration form is pre-auth)',
  has_function_privilege('anon', 'public.is_slug_available(text)', 'EXECUTE'));

select pg_temp.check(4, 'authenticated holds EXECUTE too',
  has_function_privilege('authenticated', 'public.is_slug_available(text)', 'EXECUTE'));

-- ---------------------------------------------------------------------------
-- 5-9. Behaviour as a genuinely anonymous caller.
-- ---------------------------------------------------------------------------
select pg_temp.check(5, 'a well-formed unused slug is available (the reported gold-company case)',
  pg_temp.as_anon('gold-company') is true);

select pg_temp.check(6, 'an already-registered slug is unavailable',
  pg_temp.as_anon('taken-co') is false);

select pg_temp.check(7, 'a reserved slug is unavailable',
  pg_temp.as_anon('admin') is false and pg_temp.as_anon('home') is false);

select pg_temp.check(8, 'malformed slugs are unavailable',
  pg_temp.as_anon('Gold-Company') is false   -- uppercase
  and pg_temp.as_anon('gold company') is false -- space
  and pg_temp.as_anon('gold_company') is false -- underscore
  and pg_temp.as_anon('-gold') is false        -- leading hyphen
  and pg_temp.as_anon('gold-') is false        -- trailing hyphen
  and pg_temp.as_anon('gold--company') is false);

select pg_temp.check(9, 'length bounds are enforced',
  pg_temp.as_anon('ab') is false and pg_temp.as_anon(repeat('a', 64)) is false
  and pg_temp.as_anon(repeat('a', 63)) is true);

-- ---------------------------------------------------------------------------
-- 10-11. The definer function must not widen what anon can see.
-- ---------------------------------------------------------------------------
select pg_temp.check(10, 'anon still sees no company rows (RLS boundary unchanged)',
  pg_temp.anon_company_rows() = 0);

select pg_temp.check(11, 'the helper predicate stays off the public API surface',
  not has_function_privilege('anon', 'public.is_reserved_slug(text)', 'EXECUTE'));

rollback;
