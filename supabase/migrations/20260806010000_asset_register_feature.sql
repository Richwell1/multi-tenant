-- ===========================================================================
-- Asset Register — second full feature vertical for a catalog package.
--
-- Promotes the `asset-register` marketplace extension from catalog_only to a
-- real feature: a company-owned `assets` table, entitlement-gated RLS (mirrors
-- announcements/document_notes), the authenticated Data API grants (required —
-- evaluated before RLS), and registration as a retention-capable feature so
-- uninstall/restore/purge operate on its data. No company identifiers anywhere.
-- ===========================================================================

create table public.assets (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  asset_tag   text not null default '',
  assigned_to text not null default '',
  status      text not null default 'available',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index assets_company_idx on public.assets (company_id);
alter table public.assets enable row level security;

create policy assets_select on public.assets
  for select to authenticated
  using (public.can_use_company_package(company_id, 'asset-register'));
create policy assets_insert on public.assets
  for insert to authenticated
  with check (public.can_use_company_package(company_id, 'asset-register'));
create policy assets_update on public.assets
  for update to authenticated
  using (public.can_use_company_package(company_id, 'asset-register'))
  with check (public.can_use_company_package(company_id, 'asset-register'));
create policy assets_delete on public.assets
  for delete to authenticated
  using (public.can_use_company_package(company_id, 'asset-register'));

-- Data API grants — evaluated BEFORE RLS (feature_table_grants_guardrail checks this).
grant select, insert, update, delete on table public.assets to authenticated;

-- Promote the package: real feature + retention-capable (feature data to purge).
update public.packages
set feature_status = 'implemented', feature_table = 'assets'
where key = 'asset-register';
