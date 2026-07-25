-- =============================================================================
-- Multi-Tenants HR — Phase 5.1: Request Records (platform operations)
--
-- Customer feature requests received by email and logged by a Platform Admin.
-- This is PLATFORM-PLANE data (internal notes, email references, pipeline
-- status) — unlike tenant HR data, it is Platform-Admin-only in RLS. It is the
-- entry point of the delivery pipeline:
--   request → evaluate/classify → link package/version → diagnostics (5.2)
--   → release targeting (4.2) → installation.
--
-- The lifecycle is a small state machine enforced in the DB AND mirrored in the
-- application service (src/data/requests/transitions.ts). A request's linked
-- diagnostic is modelled as a nullable column now; the FK to a diagnostics table
-- arrives in Phase 5.2 (diagnostics attach to a request/package version).
-- =============================================================================

create type public.request_priority as enum ('low', 'medium', 'high');
create type public.request_status as enum (
  'received', 'under_review', 'approved', 'rejected',
  'in_development', 'testing', 'ready_for_release', 'released', 'installed', 'closed'
);

create table public.request_records (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,
  source_email_reference text not null,
  title                  text not null,
  request_type           text not null,
  description            text not null,
  priority               public.request_priority not null default 'medium',
  status                 public.request_status not null default 'received',
  internal_note          text not null default '',
  linked_package_key     text references public.packages (key) on delete set null,
  linked_package_version text,
  -- FK to diagnostics deferred to Phase 5.2 (table does not exist yet).
  diagnostic_id          uuid,
  created_by             uuid references auth.users (id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index request_records_company_idx on public.request_records (company_id);
create index request_records_status_idx on public.request_records (status);
create index request_records_package_idx on public.request_records (linked_package_key);

create trigger request_records_set_updated_at
  before update on public.request_records
  for each row execute function public.set_updated_at();

-- --- Lifecycle state machine -------------------------------------------------
-- Central pipeline rule (mirrored in src/data/requests/transitions.ts). 'rejected'
-- and 'closed' are terminal; 'closed' is reachable from any active state so an
-- admin can always retire a request.
create or replace function public.request_status_can_transition(
  from_status public.request_status,
  to_status public.request_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when from_status = to_status then true
    when to_status = 'closed' and from_status not in ('rejected', 'closed') then true
    when from_status = 'received'          and to_status in ('under_review', 'rejected') then true
    when from_status = 'under_review'      and to_status in ('approved', 'rejected') then true
    when from_status = 'approved'          and to_status in ('in_development', 'rejected') then true
    when from_status = 'in_development'    and to_status in ('testing') then true
    when from_status = 'testing'           and to_status in ('ready_for_release', 'in_development') then true
    when from_status = 'ready_for_release' and to_status in ('released') then true
    when from_status = 'released'          and to_status in ('installed') then true
    else false
  end;
$$;

create or replace function public.enforce_request_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not public.request_status_can_transition(old.status, new.status) then
      raise exception 'invalid request status transition from % to %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger request_records_enforce_transition
  before update on public.request_records
  for each row execute function public.enforce_request_transition();

-- --- Audit / request history (real actor via auth.uid(), no spoofing) --------
create or replace function public.log_request_audit()
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
    v_action := 'request.created';
    v_meta := jsonb_build_object('status', new.status, 'priority', new.priority);
  elsif new.status is distinct from old.status then
    v_action := 'request.status_changed';
    v_meta := jsonb_build_object('from', old.status, 'to', new.status);
  else
    v_action := 'request.updated';
    v_meta := '{}'::jsonb;
  end if;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (coalesce(new.company_id, old.company_id), auth.uid(), v_action, 'request_record',
          coalesce(new.id, old.id), v_meta);
  return coalesce(new, old);
end;
$$;
revoke execute on function public.log_request_audit() from public;
revoke execute on function public.log_request_audit() from anon;
revoke execute on function public.log_request_audit() from authenticated;

create trigger request_records_audit
  after insert or update on public.request_records
  for each row execute function public.log_request_audit();

-- --- Row-Level Security (Platform-Admin-only, platform-plane) -----------------
alter table public.request_records enable row level security;
alter table public.request_records force row level security;

create policy request_records_all on public.request_records
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
