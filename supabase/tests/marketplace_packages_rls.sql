-- Marketplace packages: Document Notes + Expense Requests self-install, feature
-- RLS, and the Document Notes 1.1.0 update to installers. 8 ok notices.

\set ON_ERROR_STOP on
begin;

insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'TestOne Co', 'testone-mp', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'TestTwo Co',  'testtwo-mp',  'active');
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'admin@x.com'),
  ('a2222222-2222-2222-2222-222222222222', 'testone-admin@x.com'),
  ('a3333333-3333-3333-3333-333333333333', 'testone-user@x.com'),
  ('b2222222-2222-2222-2222-222222222222', 'testtwo-admin@x.com');
insert into public.platform_admins (user_id) values ('a1111111-1111-1111-1111-111111111111');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'company_admin', 'active'),
  ('a0000000-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'company_user', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'b2222222-2222-2222-2222-222222222222', 'company_admin', 'active');

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
  execute 'set local role authenticated'; execute stmt; execute 'reset role'; return false;
exception when others then
  begin execute 'reset role'; exception when others then end; return true;
end; $$;
create or replace function pg_temp.actor(uid text) returns void
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)::void; $$;

-- Seeded marketplace catalog exists.
select pg_temp.check(1, 'Document Notes + Expense Requests are marketplace packages',
  (select count(*) = 2 from public.packages where key in ('document-notes','expense-requests') and category = 'marketplace_extension' and is_active));

-- Before install, a company cannot access the feature.
select pg_temp.check(2, 'feature is inaccessible before install',
  pg_temp.denied('a2222222-2222-2222-2222-222222222222',
    $$insert into public.document_notes (company_id, title) values ('a0000000-0000-0000-0000-000000000001','x')$$));

-- Company admin self-installs Document Notes.
select pg_temp.actor('a2222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.install_marketplace_extension('document-notes');
insert into public.document_notes (company_id, title, description) values ('a0000000-0000-0000-0000-000000000001', 'First note', 'hello');
reset role;
select pg_temp.check(3, 'after install the entitled company can add + read notes',
  (select count(*) = 1 from public.document_notes where company_id = 'a0000000-0000-0000-0000-000000000001'));

-- Any entitled member (company_user) can add a note.
select pg_temp.actor('a3333333-3333-3333-3333-333333333333');
set local role authenticated;
insert into public.document_notes (company_id, title) values ('a0000000-0000-0000-0000-000000000001', 'From user');
reset role;
select pg_temp.check(4, 'entitled company_user can add a note',
  (select count(*) = 2 from public.document_notes where company_id = 'a0000000-0000-0000-0000-000000000001'));

-- A non-installing company cannot read or write the feature.
select pg_temp.actor('b2222222-2222-2222-2222-222222222222');
set local role authenticated;
select pg_temp.check(5, 'non-installer cannot read another company''s notes',
  (select count(*) = 0 from public.document_notes));
reset role;
select pg_temp.check(6, 'non-installer cannot add notes (no entitlement)',
  pg_temp.denied('b2222222-2222-2222-2222-222222222222',
    $$insert into public.document_notes (company_id, title) values ('b0000000-0000-0000-0000-000000000002','x')$$));

-- Admin pushes Document Notes 1.1.0 → only the installer (TestOne) moves.
select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.publish_update_to_installers((select id from public.package_versions where package_key = 'document-notes' and version = '1.1.0'));
reset role;
select pg_temp.check(7, 'Document Notes update reaches installers only',
  (select package_version = '1.1.0' from public.company_packages where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes')
  and not exists (select 1 from public.company_packages where company_id = 'b0000000-0000-0000-0000-000000000002' and package_key = 'document-notes'));

-- Expense Requests self-install + entitlement-gated insert.
select pg_temp.actor('a2222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.install_marketplace_extension('expense-requests');
insert into public.expense_requests (company_id, amount, description) values ('a0000000-0000-0000-0000-000000000001', 42.50, 'Taxi');
reset role;
select pg_temp.check(8, 'Expense Requests installs and accepts an entitled insert',
  (select count(*) = 1 from public.expense_requests where company_id = 'a0000000-0000-0000-0000-000000000001'));

rollback;
