-- Multi-Tenants HR — private standalone package: Custom Visitor Register
--
-- A unique feature built for exactly one company, with no base dependency, hidden
-- from the marketplace. Platform-Admin installs/updates it; only the assigned
-- company sees it. Entitlement-gated via can_use_company_package. The key is
-- reusable (custom-visitor-register) — no company identifier anywhere.

create table public.visitor_register (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  visitor_name  text not null,
  visit_purpose text not null default '',
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index visitor_register_company_idx on public.visitor_register (company_id);
alter table public.visitor_register enable row level security;

create policy visitor_register_select on public.visitor_register
  for select to authenticated
  using (public.can_use_company_package(company_id, 'custom-visitor-register'));
create policy visitor_register_insert on public.visitor_register
  for insert to authenticated
  with check (public.can_use_company_package(company_id, 'custom-visitor-register'));

-- Hidden private standalone package (Admin assigns it to one company).
insert into public.packages (key, name, type, is_active, category) values
  ('custom-visitor-register', 'Custom Visitor Register', 'private_customization', true, 'private_standalone')
on conflict (key) do nothing;
insert into public.package_versions (package_key, version, notes, released_at, diagnostic_status) values
  ('custom-visitor-register', '1.0.0', 'Simple visitor register.', null, 'PASS')
on conflict (package_key, version) do nothing;
