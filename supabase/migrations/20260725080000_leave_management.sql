-- =============================================================================
-- Multi-Tenants HR — Phase 4.3A: Leave Management
--
-- The first OPTIONAL package persisted end-to-end. Access is gated by the full
-- entitlement rule, enforced here (RLS) AND in the application service:
--   active authenticated user
--   AND active company membership
--   AND active company
--   AND leave-management package globally active
--   AND company package assignment enabled
--   AND correct role (writes: company_admin)
--   AND matching company_id
--
-- Leave requests belong to an employee of the SAME company (composite FK). Status
-- moves through a small, centrally-defined machine; the actor is recorded from
-- auth.uid() (never client-supplied), and every transition is audited.
--
-- NOTE (deferred, tracked as tech debt): leave "type" is modelled as an enum
-- matching the current UI's fixed categories rather than a per-company
-- leave_types table — there is no leave-type management surface yet. Employee
-- self-service (company_user creating own requests) and an hr_manager role are
-- also deferred; writes are scoped to company_admin for this increment.
-- =============================================================================

create type public.leave_type as enum ('annual', 'sick', 'unpaid');
create type public.leave_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');

-- Composite-FK target so a leave request's employee must share its company.
alter table public.employees
  add constraint employees_company_id_unique unique (company_id, id);

-- --- Combined entitlement helper --------------------------------------------
-- The single source of truth for "may this user use this package in this
-- company?": active membership + active company + enabled & globally-active
-- package. Feature policies compose this with a role check.
create or replace function public.can_use_company_package(
  target_company uuid,
  target_package text,
  uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_company_member(target_company, uid)
     and exists (
       select 1 from public.companies c
       where c.id = target_company and c.status = 'active'
     )
     and public.company_has_package(target_company, target_package);
$$;
revoke execute on function public.can_use_company_package(uuid, text, uuid) from public;
revoke execute on function public.can_use_company_package(uuid, text, uuid) from anon;
grant execute on function public.can_use_company_package(uuid, text, uuid) to authenticated;

-- --- Leave requests ----------------------------------------------------------
create table public.leave_requests (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  employee_id  uuid not null,
  leave_type   public.leave_type not null,
  start_date   date not null,
  end_date     date not null,
  status       public.leave_request_status not null default 'pending',
  reason       text,
  reviewed_by  uuid references auth.users (id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- The employee must belong to the same company as the request.
  constraint leave_requests_employee_same_company
    foreign key (company_id, employee_id) references public.employees (company_id, id),
  constraint leave_requests_date_order check (start_date <= end_date)
);

create index leave_requests_company_idx on public.leave_requests (company_id);
create index leave_requests_company_status_idx on public.leave_requests (company_id, status);
create index leave_requests_company_employee_idx on public.leave_requests (company_id, employee_id);

create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();

-- --- Status machine + server-side actor stamping -----------------------------
-- Central transition rule (mirrored in the application service):
--   pending → approved | rejected | cancelled   (all terminal)
-- A status change also stamps the real reviewer from auth.uid() so the actor
-- can never be spoofed by the client.
create or replace function public.enforce_leave_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'leave requests must start in pending status'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending'
       or new.status not in ('approved', 'rejected', 'cancelled') then
      raise exception 'invalid leave status transition from % to %', old.status, new.status
        using errcode = 'check_violation';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger leave_requests_enforce_transition
  before insert or update on public.leave_requests
  for each row execute function public.enforce_leave_transition();

-- --- Audit (real actor via auth.uid(), no spoofing) --------------------------
create or replace function public.log_leave_audit()
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
    v_action := 'leave.requested';
  elsif new.status is distinct from old.status then
    v_action := case new.status
      when 'approved' then 'leave.approved'
      when 'rejected' then 'leave.rejected'
      when 'cancelled' then 'leave.cancelled'
      else 'leave.updated'
    end;
    v_meta := jsonb_build_object('from', old.status, 'to', new.status);
  else
    v_action := 'leave.updated';
  end if;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (coalesce(new.company_id, old.company_id), auth.uid(), v_action, 'leave_request', coalesce(new.id, old.id), v_meta);
  return coalesce(new, old);
end;
$$;
revoke execute on function public.log_leave_audit() from public;
revoke execute on function public.log_leave_audit() from anon;
revoke execute on function public.log_leave_audit() from authenticated;

create trigger leave_requests_audit
  after insert or update on public.leave_requests
  for each row execute function public.log_leave_audit();

-- --- Row-Level Security ------------------------------------------------------
alter table public.leave_requests enable row level security;
alter table public.leave_requests force row level security;

-- Read: any active member of an entitled, active company (plus platform admin
-- oversight). Write: entitled AND company_admin AND matching company_id.
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (
    public.is_platform_admin()
    or public.can_use_company_package(company_id, 'leave-management')
  );

create policy leave_requests_insert on public.leave_requests
  for insert to authenticated
  with check (
    public.can_use_company_package(company_id, 'leave-management')
    and public.has_company_role(company_id, 'company_admin')
  );

create policy leave_requests_update on public.leave_requests
  for update to authenticated
  using (
    public.can_use_company_package(company_id, 'leave-management')
    and public.has_company_role(company_id, 'company_admin')
  )
  with check (
    public.can_use_company_package(company_id, 'leave-management')
    and public.has_company_role(company_id, 'company_admin')
  );
