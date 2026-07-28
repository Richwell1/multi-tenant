-- ===========================================================================
-- Company Announcements — first full feature vertical for a catalog package.
--
-- Promotes the `company-announcements` marketplace extension from catalog_only
-- to a real feature: a company-owned `announcements` table, entitlement-gated
-- RLS (mirrors document_notes), the authenticated Data API grants (required —
-- privileges are checked before RLS), and registration as a retention-capable
-- feature (feature_table set) so uninstall/restore/purge operate on its data.
-- No company identifiers anywhere; entitlement + RLS remain the boundary.
-- ===========================================================================

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  title       text not null,
  body        text not null default '',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index announcements_company_idx on public.announcements (company_id);
alter table public.announcements enable row level security;

create policy announcements_select on public.announcements
  for select to authenticated
  using (public.can_use_company_package(company_id, 'company-announcements'));
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (public.can_use_company_package(company_id, 'company-announcements'));
create policy announcements_update on public.announcements
  for update to authenticated
  using (public.can_use_company_package(company_id, 'company-announcements'))
  with check (public.can_use_company_package(company_id, 'company-announcements'));
create policy announcements_delete on public.announcements
  for delete to authenticated
  using (public.can_use_company_package(company_id, 'company-announcements'));

-- Data API grants — evaluated BEFORE RLS. Missing these is the classic 42501
-- (caught by feature_table_grants_guardrail.sql if omitted).
grant select, insert, update, delete on table public.announcements to authenticated;

-- Promote the package: real feature + retention-capable (feature data to purge).
update public.packages
set feature_status = 'implemented', feature_table = 'announcements'
where key = 'company-announcements';
