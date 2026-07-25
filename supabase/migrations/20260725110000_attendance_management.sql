-- =============================================================================
-- Multi-Tenants HR — Phase 4.3B: Attendance Management
--
-- The second optional package. Same entitlement architecture as Leave: access is
-- gated by the full rule, enforced in RLS AND the application service via
-- can_use_company_package(company_id, 'attendance-management'):
--   active user AND active membership AND active company
--   AND attendance-management enabled + globally active
--   AND correct role (writes: company_admin) AND matching company_id
--
-- One attendance row per employee per day (unique). Times are modelled as
-- time-of-day (the approved UI shows HH:MM, not full timestamps); total hours are
-- derived, never stored. Check-in/check-out is a small state machine, enforced in
-- the DB and mirrored in the service. The actor is recorded from auth.uid().
--
-- Deferred (tracked): employee self-check-in (company_user) awaits reliable
-- auth-user→employee linkage; an hr_manager role is not introduced here.
-- =============================================================================

create type public.attendance_status as enum ('present', 'late', 'absent');

create table public.attendance_records (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  employee_id     uuid not null,
  attendance_date date not null,
  check_in_time   time,
  check_out_time  time,
  status          public.attendance_status not null default 'present',
  notes           text,
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- The employee must belong to the same company as the record.
  constraint attendance_employee_same_company
    foreign key (company_id, employee_id) references public.employees (company_id, id),
  -- At most one attendance row per employee per day.
  constraint attendance_one_per_employee_day unique (company_id, employee_id, attendance_date),
  -- A check-out requires a check-in and cannot precede it (same-day assumption).
  constraint attendance_checkout_after_checkin
    check (check_out_time is null or (check_in_time is not null and check_out_time >= check_in_time))
);

create index attendance_company_idx on public.attendance_records (company_id);
create index attendance_company_date_idx on public.attendance_records (company_id, attendance_date);
create index attendance_company_employee_idx on public.attendance_records (company_id, employee_id);

create trigger attendance_set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- --- Check-in/check-out state machine + actor stamping -----------------------
-- Central rule (mirrored in src/data/attendance/transitions.ts):
--   no check-in → check-in allowed
--   checked in  → check-out allowed
--   checked out → terminal (no re-check-out)
create or replace function public.enforce_attendance_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- A completed record cannot be checked out again.
    if old.check_out_time is not null and new.check_out_time is distinct from old.check_out_time then
      raise exception 'attendance is already checked out' using errcode = 'check_violation';
    end if;
    new.updated_by := auth.uid();
  end if;
  -- A check-out is meaningless without a check-in (belt-and-braces with the CHECK).
  if new.check_out_time is not null and new.check_in_time is null then
    raise exception 'cannot check out without a check-in' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger attendance_enforce_transition
  before insert or update on public.attendance_records
  for each row execute function public.enforce_attendance_transition();

-- --- Audit (real actor via auth.uid(), no spoofing) --------------------------
create or replace function public.log_attendance_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := case when new.check_in_time is not null then 'attendance.checked_in' else 'attendance.created' end;
    v_meta := jsonb_build_object('date', new.attendance_date, 'status', new.status);
  elsif old.check_out_time is null and new.check_out_time is not null then
    v_action := 'attendance.checked_out';
    v_meta := jsonb_build_object('check_in', new.check_in_time, 'check_out', new.check_out_time);
  else
    v_action := 'attendance.updated';
    v_meta := jsonb_build_object('from_status', old.status, 'to_status', new.status);
  end if;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (coalesce(new.company_id, old.company_id), auth.uid(), v_action, 'attendance_record',
          coalesce(new.id, old.id),
          v_meta || jsonb_build_object('employee_id', coalesce(new.employee_id, old.employee_id)));
  return coalesce(new, old);
end;
$$;
revoke execute on function public.log_attendance_audit() from public;
revoke execute on function public.log_attendance_audit() from anon;
revoke execute on function public.log_attendance_audit() from authenticated;

create trigger attendance_audit
  after insert or update on public.attendance_records
  for each row execute function public.log_attendance_audit();

-- --- Row-Level Security ------------------------------------------------------
alter table public.attendance_records enable row level security;
alter table public.attendance_records force row level security;

-- Read: entitled active member of an active company (Platform Admin is NOT given
-- broad access to tenant attendance — it manages packages, not HR data).
-- Write: entitled AND company_admin AND matching company_id.
create policy attendance_select on public.attendance_records
  for select to authenticated
  using (public.can_use_company_package(company_id, 'attendance-management'));

create policy attendance_insert on public.attendance_records
  for insert to authenticated
  with check (
    public.can_use_company_package(company_id, 'attendance-management')
    and public.has_company_role(company_id, 'company_admin')
  );

create policy attendance_update on public.attendance_records
  for update to authenticated
  using (
    public.can_use_company_package(company_id, 'attendance-management')
    and public.has_company_role(company_id, 'company_admin')
  )
  with check (
    public.can_use_company_package(company_id, 'attendance-management')
    and public.has_company_role(company_id, 'company_admin')
  );
