-- =============================================================================
-- Multi-Tenants HR — Backend Phase 2 (Stage 2): auth & company onboarding
--
-- Adds:
--   company_settings, audit_logs
--   onboard_company()  — atomic, SECURITY DEFINER, service_role-only
--
-- No Employees / Departments / Positions here (later phases).
-- =============================================================================

-- --- company_settings (tenant-owned, 1:1 with companies) ---------------------
create table public.company_settings (
  company_id    uuid primary key references public.companies (id) on delete cascade,
  company_email text,
  phone         text,
  logo_url      text,
  timezone      text,
  locale        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger company_settings_set_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

alter table public.company_settings enable row level security;

-- Members read their company's settings; company admins (or platform) update.
-- No client INSERT/DELETE — settings rows are created by onboard_company().
create policy company_settings_select on public.company_settings
  for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(company_id));
create policy company_settings_update on public.company_settings
  for update to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
  with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

-- --- audit_logs (append-only) -------------------------------------------------
create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_company_created_idx on public.audit_logs (company_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id);

alter table public.audit_logs enable row level security;

-- Read-only for clients: platform admins read all; company admins read their own
-- company's rows. There are deliberately NO insert/update/delete policies, so
-- ordinary clients cannot write or tamper — audit rows are written only by
-- trusted SECURITY DEFINER functions (which bypass RLS), preventing actor spoofing.
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    public.is_platform_admin()
    or (company_id is not null and public.has_company_role(company_id, 'company_admin'))
  );

-- --- Atomic onboarding RPC ----------------------------------------------------
-- Creates company + settings + Company Admin membership + HR Core assignment +
-- audit log in one transaction. Raises (rolls back everything) on any failure.
-- Executable ONLY by service_role (the register-company Edge Function).
create or replace function public.onboard_company(
  p_user_id       uuid,
  p_company_name  text,
  p_slug          text,
  p_subdomain     text,
  p_company_email text default null,
  p_phone         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug       text;
  v_subdomain  text;
  v_company_id uuid;
  v_hr_version text;
  v_role       public.company_role := 'company_admin';
begin
  -- Normalize.
  v_slug := lower(trim(coalesce(p_slug, '')));
  v_subdomain := lower(trim(coalesce(nullif(p_subdomain, ''), p_slug)));

  -- Validate format (lowercase, digits, single hyphens).
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid_slug' using errcode = '22023';
  end if;
  if v_subdomain !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid_subdomain' using errcode = '22023';
  end if;
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'invalid_company_name' using errcode = '22023';
  end if;

  -- The auth user must exist (created by the trusted Edge Function).
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  -- Distinct duplicate checks.
  if exists (select 1 from public.companies c where c.slug = v_slug) then
    raise exception 'duplicate_slug' using errcode = '23505';
  end if;
  if exists (select 1 from public.companies c where c.subdomain = v_subdomain) then
    raise exception 'duplicate_subdomain' using errcode = '23505';
  end if;

  -- A user may not already belong to a company.
  if exists (select 1 from public.company_memberships m where m.user_id = p_user_id) then
    raise exception 'user_already_member' using errcode = '23505';
  end if;

  -- Latest active HR Core version.
  select pv.version into v_hr_version
  from public.package_versions pv
  join public.packages p on p.key = pv.package_key
  where pv.package_key = 'hr-core' and p.is_active
  order by pv.released_at desc nulls last, pv.created_at desc
  limit 1;
  if v_hr_version is null then
    raise exception 'hr_core_unavailable' using errcode = 'P0001';
  end if;

  -- Create the tenant + related rows (atomic).
  insert into public.companies (name, slug, subdomain, status)
  values (trim(p_company_name), v_slug, v_subdomain, 'active')
  returning id into v_company_id;

  insert into public.company_settings (company_id, company_email, phone)
  values (v_company_id, p_company_email, p_phone);

  insert into public.company_memberships (company_id, user_id, role)
  values (v_company_id, p_user_id, v_role);

  insert into public.company_packages
    (company_id, package_key, package_version, enabled, status, activated_at)
  values (v_company_id, 'hr-core', v_hr_version, true, 'installed', now());

  insert into public.audit_logs
    (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_company_id, p_user_id, 'company.registered', 'company', v_company_id,
    jsonb_build_object('slug', v_slug, 'subdomain', v_subdomain, 'hr_core_version', v_hr_version)
  );

  return jsonb_build_object(
    'company_id', v_company_id,
    'slug', v_slug,
    'subdomain', v_subdomain,
    'role', v_role,
    'hr_core', jsonb_build_object('package_key', 'hr-core', 'version', v_hr_version)
  );
end;
$$;

-- Onboarding is a privileged, server-only operation.
revoke execute on function public.onboard_company(uuid, text, text, text, text, text) from public;
revoke execute on function public.onboard_company(uuid, text, text, text, text, text) from anon;
revoke execute on function public.onboard_company(uuid, text, text, text, text, text) from authenticated;
grant execute on function public.onboard_company(uuid, text, text, text, text, text) to service_role;
