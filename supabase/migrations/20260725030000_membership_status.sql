-- =============================================================================
-- Multi-Tenants HR — Stage 3: membership status
--
-- Adds an explicit membership lifecycle status and makes the RLS helper
-- functions honor it: only ACTIVE memberships grant access. Inactive/suspended
-- members lose access at the database level, not just in the UI.
-- =============================================================================

create type public.membership_status as enum ('active', 'inactive', 'suspended');

alter table public.company_memberships
  add column status public.membership_status not null default 'active';

create index company_memberships_status_idx on public.company_memberships (status);

-- Only active memberships count for membership/role checks.
create or replace function public.is_company_member(
  target_company uuid,
  uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships m
    where m.company_id = target_company
      and m.user_id = uid
      and m.status = 'active'
  );
$$;

create or replace function public.has_company_role(
  target_company uuid,
  target_role public.company_role,
  uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships m
    where m.company_id = target_company
      and m.user_id = uid
      and m.role = target_role
      and m.status = 'active'
  );
$$;
