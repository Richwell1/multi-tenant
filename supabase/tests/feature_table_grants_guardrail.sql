-- Provisioning guardrail: privilege/RLS drift detector.
--
-- Confirmed root cause it guards against: a feature table can have correct RLS
-- policies yet be missing the `authenticated` Data API table privilege. Postgres
-- evaluates table privileges BEFORE RLS, so the browser client fails with 42501
-- (as document_notes / expense_requests / visitor_register did on hosted before
-- migration 20260730010000). This suite fails loudly if any RLS-policied public
-- table lacks a grant matching one of its policy commands — so the whole class of
-- bug is caught in `npm run test:rls`/CI before it can ship.
--
-- Fully dynamic: it reads pg_policies at run time, so every future feature table
-- is covered automatically with no list to maintain. 4 ok notices.

\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

-- The (table, privilege) pairs implied by every RLS policy in public. An ALL
-- policy implies all four DML privileges; a per-command policy implies just that
-- command's privilege. This is exactly what PostgREST needs before RLS runs.
create or replace view pg_temp.policy_required_grants as
  select p.tablename, x.priv
  from pg_policies p
  cross join lateral (
    select unnest(
      case p.cmd
        when 'ALL' then array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
        else array[p.cmd]
      end
    ) as priv
  ) x
  where p.schemaname = 'public'
  group by p.tablename, x.priv;

-- 1) Primary drift check: every policy command must have its matching grant.
do $$
declare
  missing text := '';
  rec record;
begin
  for rec in
    select g.tablename, g.priv
    from pg_temp.policy_required_grants g
    where not has_table_privilege('authenticated', format('public.%I', g.tablename), g.priv)
    order by g.tablename, g.priv
  loop
    missing := missing || format('%s:%s ', rec.tablename, rec.priv);
  end loop;
  if missing <> '' then
    raise exception 'FAIL: 1 - RLS-policied tables missing authenticated grant -> %', missing;
  end if;
  raise notice 'ok: 1 - every RLS policy command has a matching authenticated table grant';
end $$;

-- 2) Companion check: a table with policies but RLS disabled silently ignores
-- them (policies are dead), which is the inverse footgun. Assert RLS is enabled
-- on every public base table that has any policy.
do $$
declare
  disabled text := '';
begin
  select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
  into disabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (select distinct tablename from pg_policies where schemaname = 'public')
    and not c.relrowsecurity;
  if disabled <> '' then
    raise exception 'FAIL: 2 - public tables have policies but RLS disabled -> %', disabled;
  end if;
  raise notice 'ok: 2 - every policied public table has row-level security enabled';
end $$;

-- 3) The guardrail is meaningful only if it actually covers the confirmed feature
-- tables. Assert each has an INSERT policy the browser client must reach.
select pg_temp.check(3, 'guardrail covers the confirmed feature tables (document_notes/expense_requests/visitor_register INSERT)',
  (select count(distinct tablename) = 3
     from pg_policies
    where schemaname = 'public'
      and tablename in ('document_notes', 'expense_requests', 'visitor_register')
      and cmd = 'INSERT'));

-- 4) Self-test: prove the detector fires. Create a real public table with an
-- INSERT policy but no authenticated grant, and confirm the drift query flags it.
-- This runs AFTER the schema-wide checks above (which must see a clean schema),
-- then the table is dropped. The whole suite rolls back regardless.
create table public._guardrail_selftest (id int);
alter table public._guardrail_selftest enable row level security;
create policy selftest_insert on public._guardrail_selftest for insert to authenticated with check (true);
revoke all on public._guardrail_selftest from authenticated;
select pg_temp.check(4, 'drift detector flags a policied table that is missing its grant',
  exists (
    select 1
    from pg_policies p
    cross join lateral (
      select unnest(
        case p.cmd when 'ALL' then array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] else array[p.cmd] end
      ) as priv
    ) x
    where p.schemaname = 'public'
      and p.tablename = '_guardrail_selftest'
      and not has_table_privilege('authenticated', 'public._guardrail_selftest', x.priv)
  ));
drop table public._guardrail_selftest;

rollback;
