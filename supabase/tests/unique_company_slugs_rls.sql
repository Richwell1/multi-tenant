-- Globally unique company slugs — DB constraints, authoritative generation, and
-- tenant isolation. Proves: duplicate slugs are impossible, duplicate NAMES are
-- fine, invalid/uppercase/reserved slugs are rejected, the backend generates a
-- unique slug (with collision-safe suffix), and a slug is never an authorization
-- bypass. 14 ok notices.

\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

-- Runs a statement, returns true if it raised (constraint / validation failure).
create or replace function pg_temp.errored(stmt text) returns boolean
language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end; $$;

-- Auth users for the authoritative-registration paths.
insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 'founder1@x.com'),
  ('f2000000-0000-0000-0000-000000000002', 'founder2@x.com'),
  ('f3000000-0000-0000-0000-000000000003', 'founder3@x.com'),
  ('f4000000-0000-0000-0000-000000000004', 'founder4@x.com'),
  ('f5000000-0000-0000-0000-000000000005', 'founder5@x.com'),
  ('f9000000-0000-0000-0000-000000000009', 'iso-user@x.com');

-- === Database constraints (direct inserts) ================================

-- 1) Duplicate slug is impossible (unique constraint companies_slug_key).
insert into public.companies (name, slug, status) values ('First Co', 'dup-slug-co', 'active');
select pg_temp.check(1, 'duplicate slug insert fails',
  pg_temp.errored($$insert into public.companies (name, slug, status) values ('Other Co', 'dup-slug-co', 'active')$$));

-- 2) Duplicate NAME is allowed as long as the slug differs.
insert into public.companies (name, slug, status) values ('Acme Ltd', 'acme-ltd-aaaa', 'active');
insert into public.companies (name, slug, status) values ('Acme Ltd', 'acme-ltd-bbbb', 'active');
select pg_temp.check(2, 'duplicate company name succeeds when slug differs',
  (select count(*) = 2 from public.companies where name = 'Acme Ltd'));

-- 3) Invalid slug format is rejected (leading hyphen / bad chars).
select pg_temp.check(3, 'invalid slug format fails',
  pg_temp.errored($$insert into public.companies (name, slug, status) values ('Bad', '-bad', 'active')$$)
  and pg_temp.errored($$insert into public.companies (name, slug, status) values ('Bad', 'bad_slug', 'active')$$));

-- 4) Uppercase stored slug is rejected (lowercase check).
select pg_temp.check(4, 'uppercase stored slug fails',
  pg_temp.errored($$insert into public.companies (name, slug, status) values ('Up', 'UpperCo', 'active')$$));

-- 5) Length bounds are enforced (below 3 / above 63).
select pg_temp.check(5, 'slug length limits are enforced',
  pg_temp.errored($$insert into public.companies (name, slug, status) values ('S', 'ab', 'active')$$)
  and pg_temp.errored(format($$insert into public.companies (name, slug, status) values ('L', %L, 'active')$$, repeat('a', 64))));

-- 6) Reserved slug is rejected at the database level.
select pg_temp.check(6, 'reserved slug direct insert fails',
  pg_temp.errored($$insert into public.companies (name, slug, status) values ('Res', 'marketplace', 'active')$$));

-- === Authoritative backend generation (public.register_company) ===========

-- 7) Auto mode generates a slug from the name.
select (public.register_company('f1000000-0000-0000-0000-000000000001', 'Rich Company', null, 'founder1@x.com', null)) ->> 'slug' as s1 \gset
select pg_temp.check(7, 'auto-generated slug is derived and persisted', :'s1' = 'rich-company'
  and exists (select 1 from public.companies where slug = 'rich-company'));

-- 8) A second company with the SAME name gets a DIFFERENT, unique slug (collision
--    → random suffix; never a predictable sequence).
select (public.register_company('f2000000-0000-0000-0000-000000000002', 'Rich Company', null, 'founder2@x.com', null)) ->> 'slug' as s2 \gset
select pg_temp.check(8, 'duplicate name yields a unique suffixed slug', :'s2' <> 'rich-company'
  and :'s2' ~ '^rich-company-[a-z0-9]{4}$'
  and (select count(distinct slug) = 2 from public.companies where name = 'Rich Company'));

-- 9) Reserved requested slug is rejected by the authoritative path.
select pg_temp.check(9, 'reserved requested slug is rejected by register_company',
  pg_temp.errored($$select public.register_company('f3000000-0000-0000-0000-000000000003', 'Res Co', 'admin', 'founder3@x.com', null)$$));

-- 10) A requested slug that is already taken is rejected (never silently suffixed).
select pg_temp.check(10, 'requested duplicate slug is rejected',
  pg_temp.errored($$select public.register_company('f4000000-0000-0000-0000-000000000004', 'Rich Two', 'rich-company', 'founder4@x.com', null)$$));

-- 11) Race-safe: pre-occupy the derived base, then auto-register the same name;
--     the insert-conflict retry still yields a unique slug (no crash, no dup).
insert into public.companies (name, slug, status) values ('Race Co', 'race-co', 'active');
select (public.register_company('f5000000-0000-0000-0000-000000000005', 'Race Co', null, 'founder5@x.com', null)) ->> 'slug' as s5 \gset
select pg_temp.check(11, 'collision retry path yields a fresh unique slug', :'s5' <> 'race-co'
  and (select count(distinct slug) = 2 from public.companies where name = 'Race Co'));

-- 12) Every company row satisfies the slug rules (existing + generated).
select pg_temp.check(12, 'all company rows have valid, non-reserved, unique slugs',
  not exists (
    select 1 from public.companies c
    where c.slug is null
       or c.slug <> lower(c.slug)
       or c.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       or char_length(c.slug) not between 3 and 63
       or public.is_reserved_slug(c.slug)
  )
  and (select count(*) = count(distinct slug) from public.companies));

-- === Tenant isolation: a slug is NOT an authorization bypass ===============

-- Two tenants + a member of only the first.
insert into public.companies (id, name, slug, status) values
  ('a9000000-0000-0000-0000-000000000009', 'Iso One', 'iso-one', 'active'),
  ('b9000000-0000-0000-0000-000000000009', 'Iso Two', 'iso-two', 'active');
-- iso-user is a member of Iso One ONLY (not of any auto-registered company).
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a9000000-0000-0000-0000-000000000009', 'f9000000-0000-0000-0000-000000000009', 'company_admin', 'active');

-- 13) As the member of Iso One, looking up Iso Two BY SLUG returns nothing (RLS).
select set_config('request.jwt.claims',
  json_build_object('sub','f9000000-0000-0000-0000-000000000009','role','authenticated')::text, true);
set local role authenticated;
select pg_temp.check(13, 'member cannot resolve another company by slug alone',
  (select count(*) = 0 from public.companies where slug = 'iso-two'));

-- 14) The member sees only their own company across the table (cross-company RLS).
select pg_temp.check(14, 'company listing is isolated to the member''s own tenant',
  (select count(*) = 1 from public.companies)
  and (select slug = 'iso-one' from public.companies limit 1));
reset role;

rollback;
