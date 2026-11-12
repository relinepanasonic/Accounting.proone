-- Employment status of a person in a company, for tax purposes: Tetap (permanent employee) or Freelance.
-- It is per company (workspace_members), because one person can work for several companies of the group.
-- A new invitation carries the status; when the person joins it is written to workspace_members.
-- NULL = not set yet (the Employee Directory shows "Set status").
alter table public.workspace_members add column if not exists employment_status text
  check (employment_status in ('tetap', 'freelance'));
alter table public.workspace_invites add column if not exists employment_status text
  check (employment_status in ('tetap', 'freelance'));
