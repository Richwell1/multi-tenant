-- Document Notes INSERT authorization: the exact rule the marketplace install
-- enables, plus the table grant that makes the browser client eligible before
-- RLS runs. 9 ok notices.

\set ON_ERROR_STOP on
begin;

insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'TestOne Co', 'testone-dn', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'TestTwo Co',  'testtwo-dn',  'active');
insert into auth.users (id, email) values
  ('a2222222-2222-2222-2222-222222222222', 'testone-admin@x.com'),
  ('b2222222-2222-2222-2222-222222222222', 'testtwo-admin@x.com');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'company_admin', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'b2222222-2222-2222-2222-222222222222', 'company_admin', 'active');
-- TestOne has Document Notes enabled via a marketplace install; TestTwo does not.
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source) values
  ('a0000000-0000-0000-0000-000000000001', 'document-notes', '1.0.0', true, 'installed', now(), 'company_marketplace');

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

-- The browser client (authenticated) must be able to reach the table at all —
-- grants are evaluated before RLS. Missing grants were the hosted-only failure.
select pg_temp.check(1, 'authenticated has INSERT + SELECT privilege on document_notes',
  has_table_privilege('authenticated', 'public.document_notes', 'INSERT')
  and has_table_privilege('authenticated', 'public.document_notes', 'SELECT'));

-- The authorized company_admin can insert a note.
select set_config('request.jwt.claims', json_build_object('sub','a2222222-2222-2222-2222-222222222222','role','authenticated')::text, true);
set local role authenticated;
insert into public.document_notes (company_id, title) values ('a0000000-0000-0000-0000-000000000001', 'Note');
reset role;
select pg_temp.check(2, 'entitled company_admin can insert a note',
  (select count(*) = 1 from public.document_notes where company_id = 'a0000000-0000-0000-0000-000000000001'));

-- Cross-company insert is rejected (inserted company_id must match membership).
select pg_temp.check(3, 'member cannot insert into another company',
  pg_temp.denied('a2222222-2222-2222-2222-222222222222',
    $$insert into public.document_notes (company_id, title) values ('b0000000-0000-0000-0000-000000000002','X')$$));

-- Company without the entitlement is rejected.
select pg_temp.check(4, 'company_admin without entitlement cannot insert',
  pg_temp.denied('b2222222-2222-2222-2222-222222222222',
    $$insert into public.document_notes (company_id, title) values ('b0000000-0000-0000-0000-000000000002','X')$$));

-- Suspended company is rejected, then restored.
update public.companies set status = 'suspended' where id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.check(5, 'suspended company cannot insert',
  pg_temp.denied('a2222222-2222-2222-2222-222222222222',
    $$insert into public.document_notes (company_id, title) values ('a0000000-0000-0000-0000-000000000001','X')$$));
update public.companies set status = 'active' where id = 'a0000000-0000-0000-0000-000000000001';

-- Inactive membership is rejected, then restored.
update public.company_memberships set status = 'inactive' where user_id = 'a2222222-2222-2222-2222-222222222222';
select pg_temp.check(6, 'inactive membership cannot insert',
  pg_temp.denied('a2222222-2222-2222-2222-222222222222',
    $$insert into public.document_notes (company_id, title) values ('a0000000-0000-0000-0000-000000000001','X')$$));
update public.company_memberships set status = 'active' where user_id = 'a2222222-2222-2222-2222-222222222222';

-- Disabled entitlement is rejected, then restored.
update public.company_packages set enabled = false where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes';
select pg_temp.check(7, 'disabled package entitlement cannot insert',
  pg_temp.denied('a2222222-2222-2222-2222-222222222222',
    $$insert into public.document_notes (company_id, title) values ('a0000000-0000-0000-0000-000000000001','X')$$));
update public.company_packages set enabled = true where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes';

-- Globally inactive package is rejected, then restored.
update public.packages set is_active = false where key = 'document-notes';
select pg_temp.check(8, 'globally inactive package cannot insert',
  pg_temp.denied('a2222222-2222-2222-2222-222222222222',
    $$insert into public.document_notes (company_id, title) values ('a0000000-0000-0000-0000-000000000001','X')$$));
update public.packages set is_active = true where key = 'document-notes';

-- Tenant isolation: TestTwo cannot read TestOne's note.
select set_config('request.jwt.claims', json_build_object('sub','b2222222-2222-2222-2222-222222222222','role','authenticated')::text, true);
set local role authenticated;
select pg_temp.check(9, 'another company cannot read the notes',
  (select count(*) = 0 from public.document_notes));
reset role;

rollback;
