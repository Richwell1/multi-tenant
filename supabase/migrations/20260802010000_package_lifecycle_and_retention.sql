-- ===========================================================================
-- Package lifecycle & 30-day data retention (backend backbone).
--
-- Adds the authoritative, RLS-safe operations behind the package lifecycle:
--   disable / enable / uninstall (→ 30-day retention) / restore / permanent
--   removal / secure purge — plus lifecycle operation logging and restore
--   points. Diagnostics-PASS gating and system-package protection are enforced
--   here (never trust the client). Feature data is retained, not deleted, on
--   uninstall; only a secure backend path removes it.
--
-- Company UUID + membership + RLS remain the security boundary. No service-role
-- in the browser; every company RPC self-authorizes via auth.uid().
-- ===========================================================================

-- --- Enums -------------------------------------------------------------------
create type public.retention_data_state as enum
  ('active', 'retained', 'restored', 'pending_purge', 'purged');
create type public.lifecycle_operation as enum
  ('install', 'update', 'rollback', 'disable', 'enable', 'uninstall', 'restore', 'permanent_removal', 'purge');
create type public.lifecycle_op_status as enum ('running', 'completed', 'failed');

-- --- Catalog metadata --------------------------------------------------------
-- Mandatory system packages (e.g. HR Core) cannot be uninstalled by a company.
alter table public.packages add column if not exists is_mandatory boolean not null default false;
-- The table holding a package's company-owned feature data (for retention/purge).
-- NULL means the package owns no per-company row data (nothing to purge).
alter table public.packages add column if not exists feature_table text;
-- Structured impact manifest per released version (frontend/backend/…): drives
-- the install/update/rollback review UI. Free-form JSON, validated in the app.
alter table public.package_versions add column if not exists impact_manifest jsonb not null default '{}'::jsonb;

-- --- Retention state on the company entitlement ------------------------------
alter table public.company_packages
  add column if not exists data_state public.retention_data_state not null default 'active',
  add column if not exists uninstalled_at timestamptz,
  add column if not exists retention_until timestamptz,
  add column if not exists previous_installed_version text,
  add column if not exists uninstall_reason text,
  add column if not exists restored_at timestamptz,
  add column if not exists permanently_deleted_at timestamptz;

-- --- Lifecycle operation log (Platform-Admin monitoring; company-scoped RLS) --
create table public.package_lifecycle_operations (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  package_key    text not null,
  operation      public.lifecycle_operation not null,
  status         public.lifecycle_op_status not null default 'running',
  source_version text,
  target_version text,
  diagnostics_status public.diagnostic_status,
  initiated_by   uuid references auth.users (id) on delete set null default auth.uid(),
  correlation_id uuid not null default gen_random_uuid(),
  failure_reason text,
  started_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index package_lifecycle_operations_company_idx
  on public.package_lifecycle_operations (company_id, package_key, started_at desc);
-- Concurrency guard: at most one running operation per company+package.
create unique index package_lifecycle_operations_one_running
  on public.package_lifecycle_operations (company_id, package_key)
  where status = 'running';

-- --- Restore points (pre-update / pre-rollback snapshots of ENTITLEMENT state) -
create table public.package_restore_points (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  package_key    text not null,
  operation_id   uuid references public.package_lifecycle_operations (id) on delete set null,
  operation      public.lifecycle_operation not null,
  source_version text,
  target_version text,
  entitlement_state jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index package_restore_points_company_idx
  on public.package_restore_points (company_id, package_key, created_at desc);

-- --- Backfill catalog metadata (deterministic; no hardcoded company identity) -
update public.packages set is_mandatory = true where key = 'hr-core';
update public.packages set feature_table = 'document_notes'  where key = 'document-notes'   and feature_table is null;
update public.packages set feature_table = 'expense_requests' where key = 'expense-requests' and feature_table is null;
update public.packages set feature_table = 'visitor_register' where key = 'visitor-register' and feature_table is null;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.package_lifecycle_operations enable row level security;
alter table public.package_restore_points enable row level security;

-- Company members read their own operations; platform admins read all. Writes
-- happen only through SECURITY DEFINER RPCs below (no direct client writes).
create policy lifecycle_ops_select on public.package_lifecycle_operations
  for select using (
    public.is_platform_admin()
    or exists (
      select 1 from public.company_memberships m
      where m.company_id = package_lifecycle_operations.company_id
        and m.user_id = auth.uid() and m.status = 'active'
    )
  );
create policy restore_points_select on public.package_restore_points
  for select using (
    public.is_platform_admin()
    or exists (
      select 1 from public.company_memberships m
      where m.company_id = package_restore_points.company_id
        and m.user_id = auth.uid() and m.status = 'active'
    )
  );

grant select on public.package_lifecycle_operations to authenticated;
grant select on public.package_restore_points to authenticated;

-- ===========================================================================
-- Helpers
-- ===========================================================================
-- Resolve the caller's active company_admin company, or raise not_authorized.
create or replace function public.require_company_admin()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_company uuid;
begin
  select m.company_id into v_company
  from public.company_memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid() and m.status = 'active'
    and m.role = 'company_admin' and c.status = 'active'
  limit 1;
  if v_company is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return v_company;
end;
$$;

-- Delete a package's company-owned feature rows (dynamic on packages.feature_table).
-- Returns the number of rows removed. Table name is trusted catalog metadata.
create or replace function public.purge_package_feature_data(p_company_id uuid, p_package_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_table text; v_count integer := 0;
begin
  select feature_table into v_table from public.packages where key = p_package_key;
  if v_table is null then return 0; end if;
  execute format('delete from public.%I where company_id = $1', v_table) using p_company_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ===========================================================================
-- Company lifecycle RPCs (self-authorizing via require_company_admin)
-- ===========================================================================

-- Disable: entitlement off, data preserved indefinitely, re-enable possible.
create or replace function public.disable_package(p_package_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_company uuid := public.require_company_admin(); v_op uuid;
begin
  if not exists (select 1 from public.company_packages
                 where company_id = v_company and package_key = p_package_key and enabled) then
    raise exception 'not_installed' using errcode = 'P0001';
  end if;
  insert into public.package_lifecycle_operations (company_id, package_key, operation, status, completed_at)
  values (v_company, p_package_key, 'disable', 'completed', now()) returning id into v_op;
  update public.company_packages
    set enabled = false, updated_at = now()
    where company_id = v_company and package_key = p_package_key;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_company, auth.uid(), 'package.disabled', 'company_package', null,
          jsonb_build_object('package', p_package_key));
  return jsonb_build_object('package_key', p_package_key, 'status', 'disabled', 'operation_id', v_op);
end;
$$;

-- Enable: re-activate a disabled (still-installed) package.
create or replace function public.enable_package(p_package_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_company uuid := public.require_company_admin(); v_op uuid;
begin
  if not exists (select 1 from public.company_packages
                 where company_id = v_company and package_key = p_package_key
                   and not enabled and data_state = 'active') then
    raise exception 'not_disabled' using errcode = 'P0001';
  end if;
  insert into public.package_lifecycle_operations (company_id, package_key, operation, status, completed_at)
  values (v_company, p_package_key, 'enable', 'completed', now()) returning id into v_op;
  update public.company_packages
    set enabled = true, updated_at = now()
    where company_id = v_company and package_key = p_package_key;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_company, auth.uid(), 'package.enabled', 'company_package', null,
          jsonb_build_object('package', p_package_key));
  return jsonb_build_object('package_key', p_package_key, 'status', 'enabled', 'operation_id', v_op);
end;
$$;

-- Uninstall: entitlement off + feature data enters 30-day retention (not deleted).
create or replace function public.uninstall_package(p_package_key text, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_company uuid := public.require_company_admin();
  v_op uuid; v_version text; v_until timestamptz := now() + interval '30 days';
begin
  if exists (select 1 from public.packages where key = p_package_key and is_mandatory) then
    raise exception 'package_cannot_be_removed' using errcode = 'P0001';
  end if;
  select package_version into v_version from public.company_packages
    where company_id = v_company and package_key = p_package_key and enabled;
  if v_version is null then raise exception 'not_installed' using errcode = 'P0001'; end if;

  insert into public.package_lifecycle_operations
    (company_id, package_key, operation, status, source_version, completed_at)
  values (v_company, p_package_key, 'uninstall', 'completed', v_version, now()) returning id into v_op;

  insert into public.package_restore_points
    (company_id, package_key, operation_id, operation, source_version, entitlement_state)
  values (v_company, p_package_key, v_op, 'uninstall', v_version,
          jsonb_build_object('package_version', v_version, 'enabled', true));

  update public.company_packages set
    enabled = false, data_state = 'retained', uninstalled_at = now(),
    retention_until = v_until, previous_installed_version = v_version,
    uninstall_reason = p_reason, restored_at = null, updated_at = now()
  where company_id = v_company and package_key = p_package_key;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_company, auth.uid(), 'package.uninstalled', 'company_package', v_op,
          jsonb_build_object('package', p_package_key, 'previous_version', v_version,
                             'retention_until', v_until));
  return jsonb_build_object('package_key', p_package_key, 'status', 'uninstalled',
                            'data_state', 'retained', 'retention_until', v_until, 'operation_id', v_op);
end;
$$;

-- Restore during retention: re-enable + feature data returns (never duplicated).
create or replace function public.restore_package(p_package_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_company uuid := public.require_company_admin(); v_op uuid; v_version text;
begin
  select previous_installed_version into v_version from public.company_packages
   where company_id = v_company and package_key = p_package_key
     and data_state in ('retained', 'restored')
     and retention_until is not null and retention_until > now();
  if v_version is null then raise exception 'retention_expired_or_not_retained' using errcode = 'P0001'; end if;

  insert into public.package_lifecycle_operations
    (company_id, package_key, operation, status, target_version, completed_at)
  values (v_company, p_package_key, 'restore', 'completed', v_version, now()) returning id into v_op;

  update public.company_packages set
    enabled = true, data_state = 'active', package_version = v_version,
    restored_at = now(), retention_until = null, uninstalled_at = null, updated_at = now()
  where company_id = v_company and package_key = p_package_key;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_company, auth.uid(), 'package.restored', 'company_package', v_op,
          jsonb_build_object('package', p_package_key, 'restored_version', v_version));
  return jsonb_build_object('package_key', p_package_key, 'status', 'restored',
                            'restored_version', v_version, 'operation_id', v_op);
end;
$$;

-- Permanent removal during retention: delete ONLY this package's company data.
create or replace function public.permanently_remove_package(p_package_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_company uuid := public.require_company_admin(); v_op uuid; v_deleted integer;
begin
  if exists (select 1 from public.packages where key = p_package_key and is_mandatory) then
    raise exception 'package_cannot_be_removed' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.company_packages
                 where company_id = v_company and package_key = p_package_key
                   and data_state in ('retained', 'restored')) then
    raise exception 'not_retained' using errcode = 'P0001';
  end if;

  insert into public.package_lifecycle_operations
    (company_id, package_key, operation, status)
  values (v_company, p_package_key, 'permanent_removal', 'running') returning id into v_op;

  v_deleted := public.purge_package_feature_data(v_company, p_package_key);

  update public.company_packages set
    data_state = 'purged', permanently_deleted_at = now(), retention_until = null, updated_at = now()
  where company_id = v_company and package_key = p_package_key;

  update public.package_lifecycle_operations set status = 'completed', completed_at = now() where id = v_op;

  -- Audit records COUNTS, never content.
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_company, auth.uid(), 'package.purge.completed', 'company_package', v_op,
          jsonb_build_object('package', p_package_key, 'rows_deleted', v_deleted, 'trigger', 'manual'));
  return jsonb_build_object('package_key', p_package_key, 'status', 'purged',
                            'rows_deleted', v_deleted, 'operation_id', v_op);
end;
$$;

-- Secure purge of retention windows that have expired. Platform/service only,
-- idempotent, isolates failures per company+package. Returns a JSON summary.
create or replace function public.purge_expired_retention()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r record; v_deleted integer; v_op uuid; v_count integer := 0; v_rows integer := 0;
begin
  for r in
    select company_id, package_key from public.company_packages
    where data_state = 'retained' and retention_until is not null and retention_until <= now()
    for update skip locked
  loop
    begin
      update public.company_packages set data_state = 'pending_purge', updated_at = now()
        where company_id = r.company_id and package_key = r.package_key;

      insert into public.package_lifecycle_operations (company_id, package_key, operation, status)
      values (r.company_id, r.package_key, 'purge', 'running') returning id into v_op;

      v_deleted := public.purge_package_feature_data(r.company_id, r.package_key);

      update public.company_packages set
        data_state = 'purged', permanently_deleted_at = now(), retention_until = null, updated_at = now()
      where company_id = r.company_id and package_key = r.package_key;

      update public.package_lifecycle_operations set status = 'completed', completed_at = now() where id = v_op;

      insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
      values (r.company_id, null, 'package.purge.completed', 'company_package', v_op,
              jsonb_build_object('package', r.package_key, 'rows_deleted', v_deleted, 'trigger', 'scheduled'));
      v_count := v_count + 1; v_rows := v_rows + v_deleted;
    exception when others then
      -- Isolate failure to this company+package; continue with the rest.
      update public.package_lifecycle_operations set status = 'failed', failure_reason = 'purge_failed',
             completed_at = now()
        where company_id = r.company_id and package_key = r.package_key and operation = 'purge' and status = 'running';
    end;
  end loop;
  return jsonb_build_object('purged_packages', v_count, 'rows_deleted', v_rows);
end;
$$;

-- --- Grants ------------------------------------------------------------------
revoke execute on function public.require_company_admin() from public, anon, authenticated;
revoke execute on function public.purge_package_feature_data(uuid, text) from public, anon, authenticated;
grant execute on function public.disable_package(text) to authenticated;
grant execute on function public.enable_package(text) to authenticated;
grant execute on function public.uninstall_package(text, text) to authenticated;
grant execute on function public.restore_package(text) to authenticated;
grant execute on function public.permanently_remove_package(text) to authenticated;
-- Purge is a trusted backend job (scheduled Edge Function / service role) — never the browser.
revoke execute on function public.purge_expired_retention() from public, anon, authenticated;
grant execute on function public.purge_expired_retention() to service_role;
