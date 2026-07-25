-- =============================================================================
-- Multi-Tenants HR — Phase 3 / Increment A: Departments
--
-- First HR Core table. Tenant-owned, RLS enforced, audited. Positions and
-- Employees follow in later migrations on this branch.
-- =============================================================================

-- Shared status for HR Core reference tables (matches the existing UI: active/disabled).
create type public.hr_record_status as enum ('active', 'disabled');

-- --- Audit trigger (trusted, append-only) ------------------------------------
-- SECURITY DEFINER so it can write to the RLS-protected audit_logs table, using
-- the REAL authenticated user (auth.uid()) — the browser cannot spoof the actor.
create or replace function public.log_hr_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_action text := v_entity || '.' ||
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else lower(tg_op) end;
begin
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.company_id, old.company_id),
    auth.uid(),
    v_action,
    v_entity,
    coalesce(new.id, old.id),
    '{}'::jsonb
  );
  return coalesce(new, old);
end;
$$;
-- Not directly callable by clients.
revoke execute on function public.log_hr_audit() from public;
revoke execute on function public.log_hr_audit() from anon;
revoke execute on function public.log_hr_audit() from authenticated;

-- --- departments -------------------------------------------------------------
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  code        text not null,
  head        text,
  status      public.hr_record_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Unique WITHIN a company; the same name/code may exist in another company.
  unique (company_id, name),
  unique (company_id, code)
);
create index departments_company_idx on public.departments (company_id);
create index departments_company_status_idx on public.departments (company_id, status);

create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();
create trigger departments_audit
  after insert or update on public.departments
  for each row execute function public.log_hr_audit('department');

alter table public.departments enable row level security;
alter table public.departments force row level security;

-- Read: platform admin or any active company member.
-- Write: platform admin or the company's admin (our role model is
-- company_admin / company_user; company_user is read-only).
create policy departments_select on public.departments
  for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(company_id));
create policy departments_write on public.departments
  for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
  with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));
