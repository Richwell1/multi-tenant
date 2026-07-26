-- Multi-Tenants HR — marketplace packages: Document Notes + Expense Requests
--
-- Two minimal, reusable marketplace extensions any active company may install
-- from the Extensions Marketplace. Entitlement-gated via can_use_company_package
-- (mirrors leave/attendance). No company identifiers anywhere.

-- --- Document Notes -----------------------------------------------------------
create table public.document_notes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  title       text not null,
  description text not null default '',
  category    text,                         -- introduced in Document Notes 1.1.0
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index document_notes_company_idx on public.document_notes (company_id);
alter table public.document_notes enable row level security;

create policy document_notes_select on public.document_notes
  for select to authenticated
  using (public.can_use_company_package(company_id, 'document-notes'));
create policy document_notes_insert on public.document_notes
  for insert to authenticated
  with check (public.can_use_company_package(company_id, 'document-notes'));

-- --- Expense Requests ---------------------------------------------------------
create table public.expense_requests (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  amount      numeric(12,2) not null default 0,
  description text not null default '',
  status      text not null default 'submitted',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index expense_requests_company_idx on public.expense_requests (company_id);
alter table public.expense_requests enable row level security;

create policy expense_requests_select on public.expense_requests
  for select to authenticated
  using (public.can_use_company_package(company_id, 'expense-requests'));
create policy expense_requests_insert on public.expense_requests
  for insert to authenticated
  with check (public.can_use_company_package(company_id, 'expense-requests'));

-- --- Catalog seed (marketplace, not auto-assigned to any company) ------------
-- Document Notes: 1.0.0 released; 1.1.0 unreleased (Admin pushes it as the
-- marketplace update, which adds the note category field).
insert into public.packages (key, name, type, is_active, category) values
  ('document-notes', 'Document Notes', 'standard_update', true, 'marketplace_extension'),
  ('expense-requests', 'Expense Requests', 'standard_update', true, 'marketplace_extension')
on conflict (key) do nothing;

insert into public.package_versions (package_key, version, notes, released_at, diagnostic_status) values
  ('document-notes', '1.0.0', 'Document Notes 1.0.0 — simple notes.', now(), 'PASS'),
  ('document-notes', '1.1.0', 'Document Notes 1.1.0 — adds a note category.', null, 'PASS'),
  ('expense-requests', '1.0.0', 'Expense Requests 1.0.0 — simple expense requests.', now(), 'PASS')
on conflict (package_key, version) do nothing;
