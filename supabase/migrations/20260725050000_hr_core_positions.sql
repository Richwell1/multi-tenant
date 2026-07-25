-- =============================================================================
-- Multi-Tenants HR — Phase 3 / Increment B: Positions
--
-- Tenant-owned, RLS-forced, audited. A position's department must belong to the
-- SAME company — enforced at the database level via a COMPOSITE foreign key
-- (company_id, department_id) → departments(company_id, id), not just RLS/UI.
-- =============================================================================

-- Composite-FK target: make (company_id, id) uniquely referable on departments.
alter table public.departments
  add constraint departments_company_id_unique unique (company_id, id);

create table public.positions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  department_id uuid,
  title         text not null,
  code          text not null,
  reports_to    text,
  status        public.hr_record_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Same-company relationship. MATCH SIMPLE: when department_id is NULL the FK
  -- is not enforced (unassigned positions allowed); when set, (company_id,
  -- department_id) must exist in departments → cannot borrow another company's
  -- department. NO ACTION on delete is safe (departments are disabled, not
  -- hard-deleted; company deletion cascades both together).
  constraint positions_department_same_company
    foreign key (company_id, department_id)
    references public.departments (company_id, id),
  unique (company_id, title),
  unique (company_id, code)
);

create index positions_company_idx on public.positions (company_id);
create index positions_company_status_idx on public.positions (company_id, status);
create index positions_department_idx on public.positions (department_id);
create index positions_company_department_idx on public.positions (company_id, department_id);

create trigger positions_set_updated_at
  before update on public.positions
  for each row execute function public.set_updated_at();
create trigger positions_audit
  after insert or update on public.positions
  for each row execute function public.log_hr_audit('position');

alter table public.positions enable row level security;
alter table public.positions force row level security;

create policy positions_select on public.positions
  for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(company_id));
create policy positions_write on public.positions
  for all to authenticated
  using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
  with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));
