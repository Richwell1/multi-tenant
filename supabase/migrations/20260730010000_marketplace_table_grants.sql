-- The Data API requires table privileges before RLS policies are evaluated.
-- The marketplace/private feature tables were added after the original
-- api_role_grants migration, so the browser client (authenticated role) was not
-- eligible to reach them — INSERTs were denied at the privilege level on hosted
-- Supabase, even though their RLS policies are correct. (Locally, default
-- privileges auto-grant, which masked the gap.) These grants restore eligibility;
-- the entitlement-gated RLS policies remain the authoritative boundary.

grant select, insert, update, delete on table
  public.document_notes,
  public.expense_requests,
  public.visitor_register
to authenticated;

-- Marketplace card copy (shown to companies browsing the Extensions Marketplace).
update public.packages set description = 'Create simple internal notes for your company.'
  where key = 'document-notes' and coalesce(description, '') = '';
update public.packages set description = 'Record and track basic company expense requests.'
  where key = 'expense-requests' and coalesce(description, '') = '';
