-- ===========================================================================
-- Custom Onboarding Checklist — first Private Customization vertical.
--
-- A private extension of HR Core, assigned to one company by the Platform Admin.
-- It renders INSIDE the HR Core Employees surface (not a standalone route). It
-- owns company data (checklist items) via a `onboarding_checklist_items` table
-- with entitlement-gated RLS (mirrors the marketplace feature tables) plus the
-- authenticated Data API grants (required — evaluated before RLS), and it is
-- registered as retention-capable (feature_table) so uninstall/restore/purge
-- operate on its data. No company identifiers anywhere.
-- ===========================================================================

create table public.onboarding_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  label       text not null,
  done        boolean not null default false,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index onboarding_checklist_items_company_idx on public.onboarding_checklist_items (company_id);
alter table public.onboarding_checklist_items enable row level security;

create policy onboarding_checklist_select on public.onboarding_checklist_items
  for select to authenticated
  using (public.can_use_company_package(company_id, 'custom-onboarding-checklist'));
create policy onboarding_checklist_insert on public.onboarding_checklist_items
  for insert to authenticated
  with check (public.can_use_company_package(company_id, 'custom-onboarding-checklist'));
create policy onboarding_checklist_update on public.onboarding_checklist_items
  for update to authenticated
  using (public.can_use_company_package(company_id, 'custom-onboarding-checklist'))
  with check (public.can_use_company_package(company_id, 'custom-onboarding-checklist'));
create policy onboarding_checklist_delete on public.onboarding_checklist_items
  for delete to authenticated
  using (public.can_use_company_package(company_id, 'custom-onboarding-checklist'));

-- Data API grants — evaluated BEFORE RLS (feature_table_grants_guardrail checks this).
grant select, insert, update, delete on table public.onboarding_checklist_items to authenticated;

-- Promote the package: real feature + retention-capable.
update public.packages
set feature_status = 'implemented', feature_table = 'onboarding_checklist_items'
where key = 'custom-onboarding-checklist';
