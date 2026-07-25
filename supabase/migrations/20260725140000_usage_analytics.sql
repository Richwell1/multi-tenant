-- =============================================================================
-- Multi-Tenants HR — Phase 5.4: Usage Analytics (platform operations)
--
-- Usage is DERIVED from the existing audit trail rather than tracked separately:
-- every meaningful action already writes an `audit_logs` row (employee.*, leave.*,
-- attendance.*, request.*, package.*, diagnostic.*, installation.* …). A module
-- is the action prefix; a metric is the action count plus the number of distinct
-- companies that produced those actions.
--
-- Platform-plane read: the function self-gates on is_platform_admin() (a non-admin
-- caller simply gets an empty result). An optional company filter scopes the
-- aggregate to a company-target selection.
-- =============================================================================

create or replace function public.usage_metrics(p_company_ids uuid[] default null)
returns table (module text, action_count bigint, companies_using bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    split_part(a.action, '.', 1)      as module,
    count(*)                          as action_count,
    count(distinct a.company_id)      as companies_using
  from public.audit_logs a
  where public.is_platform_admin()
    and (p_company_ids is null or a.company_id = any (p_company_ids))
  group by split_part(a.action, '.', 1)
  order by count(*) desc, module;
$$;

revoke execute on function public.usage_metrics(uuid[]) from public;
revoke execute on function public.usage_metrics(uuid[]) from anon;
grant execute on function public.usage_metrics(uuid[]) to authenticated;
