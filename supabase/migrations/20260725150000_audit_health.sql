-- =============================================================================
-- Multi-Tenants HR — Phase 5.5: Audit Surfaces & System Health (platform ops)
--
-- audit_logs already carries every action (written only by trusted triggers).
-- This adds two platform-plane read functions the admin surfaces consume:
--   platform_audit_log — enriched, human-readable audit rows (actor email +
--                        company name), joining auth.users which is otherwise
--                        RLS-restricted from clients; hence SECURITY DEFINER.
--   system_health      — live signals derived from real counts.
-- Both self-gate on is_platform_admin() (a non-admin caller gets nothing).
-- =============================================================================

create or replace function public.platform_audit_log(
  p_company_ids uuid[] default null,
  p_limit int default 200
)
returns table (
  id           uuid,
  created_at   timestamptz,
  actor        text,
  action       text,
  entity_type  text,
  target       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.created_at,
    coalesce(u.email, 'system')            as actor,
    a.action,
    a.entity_type,
    coalesce(c.name, a.entity_type)        as target
  from public.audit_logs a
  left join auth.users u on u.id = a.actor_user_id
  left join public.companies c on c.id = a.company_id
  where public.is_platform_admin()
    and (p_company_ids is null or a.company_id = any (p_company_ids))
  order by a.created_at desc
  limit greatest(p_limit, 0);
$$;
revoke execute on function public.platform_audit_log(uuid[], int) from public;
revoke execute on function public.platform_audit_log(uuid[], int) from anon;
grant execute on function public.platform_audit_log(uuid[], int) to authenticated;

-- --- System health -----------------------------------------------------------
-- Signals derived from real state. `status` matches the HealthSignal union
-- (healthy | degraded | offline).
create or replace function public.system_health()
returns table (label text, value text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  with active_companies as (
    select count(*) as n from public.companies where status = 'active'
  ),
  failed_installs as (
    select count(*) as n from public.package_installations where status = 'failed'
  ),
  recent_activity as (
    select count(*) as n from public.audit_logs where created_at > now() - interval '24 hours'
  )
  select * from (
    values
      ('Database', 'Online', 'healthy')
  ) as db(label, value, status)
  where public.is_platform_admin()
  union all
  select 'Active companies', ac.n::text, 'healthy'
    from active_companies ac where public.is_platform_admin()
  union all
  select 'Failed installations', fi.n::text,
         case when fi.n > 0 then 'degraded' else 'healthy' end
    from failed_installs fi where public.is_platform_admin()
  union all
  select 'Audit events (24h)', ra.n::text, 'healthy'
    from recent_activity ra where public.is_platform_admin();
$$;
revoke execute on function public.system_health() from public;
revoke execute on function public.system_health() from anon;
grant execute on function public.system_health() to authenticated;
