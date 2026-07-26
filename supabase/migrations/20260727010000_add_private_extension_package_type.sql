-- Multi-Tenants HR — add the `private_extension` package type
--
-- Demo package model uses three business types: standard_update,
-- private_extension (one company + required base package), and
-- private_standalone (mapped to the existing `private_customization` value).
--
-- `private_extension` is the only genuinely new concept, so it is the only new
-- enum value. Existing values are preserved unchanged (no renames).
--
-- IMPORTANT: `ALTER TYPE ... ADD VALUE` must commit before the new label can be
-- used. This migration adds the value ALONE; the column/functions that reference
-- it live in the next migration (20260727020000) so they run in a later
-- transaction where the label is already committed.

alter type public.package_type add value if not exists 'private_extension';
