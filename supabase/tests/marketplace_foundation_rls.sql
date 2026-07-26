-- Marketplace foundation: discovery restriction, company self-install gate,
-- update-to-installers, and adoption. A clean run emits 10 ok notices.

\set ON_ERROR_STOP on
begin;

insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'Alpha Co', 'alpha-mkt', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'Beta Co',  'beta-mkt',  'active');
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'admin@x.com'),
  ('a2222222-2222-2222-2222-222222222222', 'alpha-admin@x.com'),
  ('a3333333-3333-3333-3333-333333333333', 'alpha-user@x.com'),
  ('b2222222-2222-2222-2222-222222222222', 'beta-admin@x.com');
insert into public.platform_admins (user_id) values ('a1111111-1111-1111-1111-111111111111');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'company_admin', 'active'),
  ('a0000000-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'company_user', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'b2222222-2222-2222-2222-222222222222', 'company_admin', 'active');
-- Alpha has HR Core (base for a dependent marketplace package); Beta does not.
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source) values
  ('a0000000-0000-0000-0000-000000000001', 'hr-core', '1.0.0', true, 'installed', now(), 'registration_default');

-- Package fixtures (marketplace packages are catalog-seeded, so insert directly).
insert into public.packages (key, name, type, is_active, category, base_package_key) values
  ('mkt-a', 'Marketplace A', 'standard_update', true, 'marketplace_extension', null),
  ('mkt-dep', 'Marketplace Dep', 'standard_update', true, 'marketplace_extension', 'hr-core'),
  ('priv-a', 'Private A', 'private_customization', true, 'private_standalone', null);
insert into public.package_versions (package_key, version, notes, released_at, diagnostic_status) values
  ('mkt-a', '1.0.0', 'seed', now(), 'PASS'),
  ('mkt-a', '1.1.0', 'update', null, 'PASS'),
  ('mkt-dep', '1.0.0', 'seed', now(), 'PASS'),
  ('priv-a', '1.0.0', 'seed', now(), 'PASS');

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

create or replace function pg_temp.denied(uid text, stmt text) returns boolean
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute stmt;
  execute 'reset role';
  return false;
exception when others then
  begin execute 'reset role'; exception when others then end;
  return true;
end; $$;

create or replace function pg_temp.actor(uid text) returns void
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)::void; $$;

-- Discovery: a company sees marketplace packages but not private ones.
select pg_temp.actor('a2222222-2222-2222-2222-222222222222');
set local role authenticated;
select pg_temp.check(1, 'company can discover a marketplace package',
  (select count(*) = 1 from public.packages where key = 'mkt-a'));
select pg_temp.check(2, 'company cannot discover a private package',
  (select count(*) = 0 from public.packages where key = 'priv-a'));
reset role;

-- Only a company_admin can self-install.
select pg_temp.check(3, 'company_user cannot install a marketplace package',
  pg_temp.denied('a3333333-3333-3333-3333-333333333333', $$select public.install_marketplace_extension('mkt-a')$$));

-- company_admin installs the marketplace package.
select pg_temp.actor('a2222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.install_marketplace_extension('mkt-a');
reset role;
select pg_temp.check(4, 'self-install enables entitlement with company_marketplace source + record',
  (select enabled and status = 'installed' and installation_source = 'company_marketplace'
     from public.company_packages where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'mkt-a')
  and exists (select 1 from public.package_installations where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'mkt-a' and status = 'installed'));

-- Guards: private key rejected, double-install rejected, dependency enforced.
select pg_temp.check(5, 'private package cannot be company-installed by key',
  pg_temp.denied('a2222222-2222-2222-2222-222222222222', $$select public.install_marketplace_extension('priv-a')$$));
select pg_temp.check(6, 'already-installed package cannot be reinstalled',
  pg_temp.denied('a2222222-2222-2222-2222-222222222222', $$select public.install_marketplace_extension('mkt-a')$$));
select pg_temp.check(7, 'dependency enforced — Beta without HR Core cannot install a dependent package',
  pg_temp.denied('b2222222-2222-2222-2222-222222222222', $$select public.install_marketplace_extension('mkt-dep')$$));

-- Update pushed only to installers.
select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.publish_update_to_installers((select id from public.package_versions where package_key = 'mkt-a' and version = '1.1.0'));
reset role;
select pg_temp.check(8, 'update reaches installers only',
  (select package_version = '1.1.0' from public.company_packages where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'mkt-a')
  and not exists (select 1 from public.company_packages where company_id = 'b0000000-0000-0000-0000-000000000002' and package_key = 'mkt-a'));

-- Adoption: platform-admin sees counts; a company admin sees nothing.
select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;
select pg_temp.check(9, 'adoption shows the marketplace package with an installer',
  (select install_count >= 1 from public.marketplace_adoption() where package_key = 'mkt-a'));
select pg_temp.actor('a2222222-2222-2222-2222-222222222222');
select pg_temp.check(10, 'non-admin sees no adoption data',
  (select count(*) = 0 from public.marketplace_adoption()));
reset role;

rollback;
