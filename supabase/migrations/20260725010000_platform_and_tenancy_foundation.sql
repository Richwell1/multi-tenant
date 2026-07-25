-- =============================================================================
-- Multi-Tenants HR — Backend Phase 1: platform & tenancy foundation
--
-- Creates the platform/tenancy core only:
--   platform_admins, companies, company_memberships,
--   packages, package_versions, company_packages
--
-- HR Core domain tables (employees, departments, positions), package releases,
-- diagnostics, and request records are intentionally NOT created here.
--
-- Security model:
--   * Authorization is by auth.users.id and membership/role — NEVER by company
--     name. Every tenant-owned table carries company_id.
--   * packages.is_active            = global (platform) on/off switch.
--   * company_packages.enabled      = per-company on/off switch.
--   * All exposed tables have RLS enabled.
--   * Helper functions are SECURITY DEFINER with an empty search_path and are
--     fully schema-qualified; execute is revoked from PUBLIC and granted only
--     to authenticated. SECURITY DEFINER lets the policies read RLS-protected
--     tables without recursion.
-- =============================================================================

-- --- Enums -------------------------------------------------------------------
create type public.company_status as enum ('active', 'suspended');
create type public.company_role as enum ('company_admin', 'company_user');
create type public.package_type as enum (
  'standard_update', 'private_customization', 'shared_extension', 'bug_fix'
);
create type public.company_package_status as enum (
  'assigned', 'installing', 'installed', 'failed'
);

-- --- updated_at trigger helper -----------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- Tables ------------------------------------------------------------------

-- Platform Super Admins. Membership here => platform-wide control plane access.
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Tenant companies.
create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  subdomain  text unique,
  status     public.company_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- Which users belong to which company, and with what role.
create table public.company_memberships (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.company_role not null default 'company_user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_memberships_user_id_idx on public.company_memberships (user_id);
create trigger company_memberships_set_updated_at
  before update on public.company_memberships
  for each row execute function public.set_updated_at();

-- Global package catalog. is_active is the platform-wide switch.
create table public.packages (
  key        text primary key,
  name       text not null,
  type       public.package_type not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger packages_set_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

-- Versioned releases of a package (metadata only in this phase).
create table public.package_versions (
  id          uuid primary key default gen_random_uuid(),
  package_key text not null references public.packages (key) on delete cascade,
  version     text not null,
  notes       text not null default '',
  released_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (package_key, version)
);

-- Per-company package assignment. enabled is the company-specific switch.
create table public.company_packages (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  package_key     text not null references public.packages (key) on delete restrict,
  package_version text,
  enabled         boolean not null default true,
  status          public.company_package_status not null default 'assigned',
  assigned_at     timestamptz not null default now(),
  activated_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, package_key)
);
create index company_packages_package_key_idx on public.company_packages (package_key);
create trigger company_packages_set_updated_at
  before update on public.company_packages
  for each row execute function public.set_updated_at();

-- --- Authorization helper functions ------------------------------------------
-- All SECURITY DEFINER + empty search_path + schema-qualified. Authorization is
-- derived from auth.uid() and membership/role — never from company names.

create or replace function public.is_platform_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = uid
  );
$$;

create or replace function public.is_company_member(
  target_company uuid,
  uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships m
    where m.company_id = target_company
      and m.user_id = uid
  );
$$;

create or replace function public.has_company_role(
  target_company uuid,
  target_role public.company_role,
  uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships m
    where m.company_id = target_company
      and m.user_id = uid
      and m.role = target_role
  );
$$;

-- A company "has" a package only when the assignment is enabled AND the package
-- is globally active. Combine with is_company_member() in feature-table policies.
create or replace function public.company_has_package(
  target_company uuid,
  target_package text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_packages cp
    join public.packages p on p.key = cp.package_key
    where cp.company_id = target_company
      and cp.package_key = target_package
      and cp.enabled
      and p.is_active
  );
$$;

-- Lock down execution: policies run these as authenticated; nothing else needs them.
revoke execute on function public.is_platform_admin(uuid) from public;
revoke execute on function public.is_company_member(uuid, uuid) from public;
revoke execute on function public.has_company_role(uuid, public.company_role, uuid) from public;
revoke execute on function public.company_has_package(uuid, text) from public;
grant execute on function public.is_platform_admin(uuid) to authenticated;
grant execute on function public.is_company_member(uuid, uuid) to authenticated;
grant execute on function public.has_company_role(uuid, public.company_role, uuid) to authenticated;
grant execute on function public.company_has_package(uuid, text) to authenticated;

-- --- Row-Level Security ------------------------------------------------------
alter table public.platform_admins     enable row level security;
alter table public.companies           enable row level security;
alter table public.company_memberships enable row level security;
alter table public.packages            enable row level security;
alter table public.package_versions    enable row level security;
alter table public.company_packages    enable row level security;

-- platform_admins: only platform admins may read; no client writes.
create policy platform_admins_select on public.platform_admins
  for select to authenticated
  using (public.is_platform_admin());

-- companies: platform admins see all; members see their own company.
create policy companies_select on public.companies
  for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(id));
create policy companies_admin_write on public.companies
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- company_memberships: platform admins, the member themselves, or a company admin.
create policy company_memberships_select on public.company_memberships
  for select to authenticated
  using (
    public.is_platform_admin()
    or user_id = auth.uid()
    or public.has_company_role(company_id, 'company_admin')
  );
create policy company_memberships_admin_write on public.company_memberships
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- packages: authenticated users may read active packages; platform admins all.
create policy packages_select on public.packages
  for select to authenticated
  using (public.is_platform_admin() or is_active);
create policy packages_admin_write on public.packages
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- package_versions: readable when the parent package is active; platform admins all.
create policy package_versions_select on public.package_versions
  for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.packages p
      where p.key = package_key and p.is_active
    )
  );
create policy package_versions_admin_write on public.package_versions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- company_packages: platform admins all; company members read their own.
create policy company_packages_select on public.company_packages
  for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(company_id));
create policy company_packages_admin_write on public.company_packages
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- --- Seed: HR Core reference package -----------------------------------------
-- HR Core is the standard package every company receives. This is catalog
-- reference data (not sample tenants), so it lives in the migration.
insert into public.packages (key, name, type, is_active)
values ('hr-core', 'HR Core', 'standard_update', true)
on conflict (key) do nothing;

insert into public.package_versions (package_key, version, notes, released_at)
values ('hr-core', '1.0.0', 'Initial HR Core release: Employees, Departments, Positions.', now())
on conflict (package_key, version) do nothing;
