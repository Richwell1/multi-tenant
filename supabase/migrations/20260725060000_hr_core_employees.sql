-- =============================================================================
-- Multi-Tenants HR — Phase 3 / Increment C: Employees
--
-- Completes HR Core. Tenant-owned, RLS-forced, audited. An employee's
-- department AND position must belong to the SAME company — enforced by two
-- composite foreign keys. Termination is a status transition, never a delete.
-- =============================================================================

create type public.employment_type as enum ('full_time', 'part_time', 'contract');
create type public.employee_status as enum ('active', 'on_leave', 'terminated');

-- Composite-FK target on positions (departments already has one from 3B).
alter table public.positions
  add constraint positions_company_id_unique unique (company_id, id);

create table public.employees (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  user_id            uuid references auth.users (id) on delete set null,
  employee_number    text not null,
  full_name          text not null,
  work_email         text,
  department_id      uuid,
  position_id        uuid,
  employment_type    public.employment_type not null default 'full_time',
  status             public.employee_status not null default 'active',
  termination_date   date,
  termination_reason text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Same-company relationships (MATCH SIMPLE → NULL allowed for unassigned).
  constraint employees_department_same_company
    foreign key (company_id, department_id) references public.departments (company_id, id),
  constraint employees_position_same_company
    foreign key (company_id, position_id) references public.positions (company_id, id),
  unique (company_id, employee_number)
);

-- Work email unique per company, case-insensitive, only when present.
create unique index employees_company_email_unique
  on public.employees (company_id, lower(work_email))
  where work_email is not null;

create index employees_company_idx on public.employees (company_id);
create index employees_company_status_idx on public.employees (company_id, status);
create index employees_company_department_idx on public.employees (company_id, department_id);
create index employees_company_position_idx on public.employees (company_id, position_id);
create index employees_user_id_idx on public.employees (user_id);

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

-- Employee-specific audit: distinguishes create / update / status-change / terminate,
-- and records the from→to status. SECURITY DEFINER + real auth.uid() (no spoofing).
create or replace function public.log_employee_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_meta jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'employee.created';
  else
    if new.status is distinct from old.status then
      v_action := case when new.status = 'terminated' then 'employee.terminated' else 'employee.status_changed' end;
      v_meta := jsonb_build_object('from', old.status, 'to', new.status);
    else
      v_action := 'employee.updated';
    end if;
  end if;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (coalesce(new.company_id, old.company_id), auth.uid(), v_action, 'employee', coalesce(new.id, old.id), v_meta);
  return coalesce(new, old);
end;
$$;
revoke execute on function public.log_employee_audit() from public;
revoke execute on function public.log_employee_audit() from anon;
revoke execute on function public.log_employee_audit() from authenticated;

create trigger employees_audit
  after insert or update on public.employees
  for each row execute function public.log_employee_audit();

alter table public.employees enable row level security;
alter table public.employees force row level security;

create policy employees_select on public.employees
  for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(company_id));
create policy employees_write on public.employees
  for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
  with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));
