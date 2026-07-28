-- ===========================================================================
-- Pulse Surveys — third full feature vertical for a catalog package.
--
-- Promotes the `pulse-surveys` marketplace extension from catalog_only to a real
-- feature: a company-owned `pulse_surveys` table, entitlement-gated RLS (mirrors
-- assets/announcements), the authenticated Data API grants (required — evaluated
-- before RLS), and registration as a retention-capable feature so
-- uninstall/restore/purge operate on its data. No company identifiers anywhere.
-- ===========================================================================

create table public.pulse_surveys (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  question    text not null,
  description text not null default '',
  status      text not null default 'active',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index pulse_surveys_company_idx on public.pulse_surveys (company_id);
alter table public.pulse_surveys enable row level security;

create policy pulse_surveys_select on public.pulse_surveys
  for select to authenticated
  using (public.can_use_company_package(company_id, 'pulse-surveys'));
create policy pulse_surveys_insert on public.pulse_surveys
  for insert to authenticated
  with check (public.can_use_company_package(company_id, 'pulse-surveys'));
create policy pulse_surveys_update on public.pulse_surveys
  for update to authenticated
  using (public.can_use_company_package(company_id, 'pulse-surveys'))
  with check (public.can_use_company_package(company_id, 'pulse-surveys'));
create policy pulse_surveys_delete on public.pulse_surveys
  for delete to authenticated
  using (public.can_use_company_package(company_id, 'pulse-surveys'));

-- Data API grants — evaluated BEFORE RLS (feature_table_grants_guardrail checks this).
grant select, insert, update, delete on table public.pulse_surveys to authenticated;

-- Promote the package: real feature + retention-capable (feature data to purge).
update public.packages
set feature_status = 'implemented', feature_table = 'pulse_surveys'
where key = 'pulse-surveys';
