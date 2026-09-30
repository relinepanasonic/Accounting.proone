# Prompt for Claude Code (paste into the Meta Ads Tools app project)

I am connecting my Meta Ads tools app to my existing accounting web app ("Accounting Prof", Next.js + Supabase).
Both apps must use the SAME user levels and client model. Below is the exact model used by the accounting app.
Mirror it. Do not invent new role names. Before writing code, read the relevant guide in `node_modules/next/dist/docs/`
(this Next.js version has breaking changes), and inspect this app's current auth/user/client code, then propose a short
plan and wait for my approval before changing the database.

## 1. Tenancy: workspaces
- A **workspace** is a tenant (a company/brand). Table `workspaces` (id uuid, name, slug, currency, owner_id, ...).
- Every business row carries `workspace_id`; all reads/writes are scoped to the user's **active workspace**.
- Active workspace = cookie `active_workspace_id`, validated against the user's memberships
  (falls back to the first allowed workspace). Do the same here, or accept it via the shared session.
- Workspaces in use: "Prof Toko Online", "New Wave Live Specialist", "PT Pintu Langit Inovasi Global".
- Invoices can also be `assigned_workspace_id` to another workspace (inter-company); not needed for ads unless I say so.

## 2. User levels (roles), per workspace
Roles live in `workspace_members` (id, workspace_id, user_id -> auth.users, email, display_name, role,
UNIQUE(workspace_id, user_id)). A user can have a different role in each workspace.
Invitations create a row with `user_id = NULL` + email; it is linked to the user on first login (match by email, case-insensitive).

| Role | Meaning | Ads-app permission I want |
|---|---|---|
| `founder` | Owner. Hardcoded by email (nicojapar@gmail.com, relinepanasonic@gmail.com). Automatically a member of ALL workspaces, no membership row needed (uses service-role client). Cannot be edited/removed by others. | Everything, all workspaces |
| `superadmin` | Full ownership of one workspace: settings, team, assignments | Manage ad accounts, connect Meta, see all clients' ads, manage assignments |
| `accounting` | Finance modules (ledger, invoices, payroll, reconcile) | Read-only spend/ROAS reports for finance; no Meta connection or campaign edits |
| `advertiser` | Ads data input only, sees ONLY assigned clients | View/enter ads data for assigned clients only |
| `admin` | Ops (invoices/bills); legacy default | Read-only unless I say otherwise |

Notes / known inconsistency to keep in mind:
- `supabase/schema.sql` in the accounting app only allows ('superadmin','accounting','admin') in the role CHECK, but the app code
  also uses `founder` (virtual, from email) and `advertiser` (team UI). Verify the live DB constraint before relying on it,
  and make this app tolerate all five values.
- Only `superadmin`/`founder` may invite users, change roles, and create client assignments.
- Non-superadmin users with no membership rows are treated as `accounting` in all real workspaces (existing fallback). Do NOT replicate this in the ads app; deny access instead.

## 3. Clients and client-level access
- `clients` table (id, workspace_id, name, contact_type in ('client','vendor'), contact_name, email, phone, company_name, ...).
  Contacts are isolated per workspace. Only `contact_type = 'client'` are real advertising clients.
- **There is no tier/level column on clients.** "Levels" for a client come from assignment, not from a field:
  - `client_assignments` (id, workspace_id, client_id, user_id, assigned_by, UNIQUE(client_id, user_id)).
  - `superadmin`/`founder` see ALL clients in the workspace. Every other role (notably `advertiser`) sees ONLY clients present
    in `client_assignments` for their user_id. This filter is applied in the app code (advertiser page), on top of RLS.
- Advertising categories inside the accounting app (these are report sections, not client attributes):
  - Tabs: `inkubasi`, `group`, `mandiri`.
  - Group category (only for the `group` tab): `Hero` | `Reguler` | `Low`, with a free-text group name (e.g. "Group Hero 1").
  - Rows hold: iklan produk, modal, target ROAS, ROAS (auto-calculated), note. Inkubasi is locked to "Iklan Produk Otomatis" with a locked Target ROAS.
  - Stored in `advertiser_reports` (workspace_id, client_id, report_date, session int, data_inkubasi jsonb, data_group jsonb,
    data_mandiri jsonb, screenshot_url; UNIQUE(client_id, report_date, session)), plus a logs/"Start Record" workflow.
  - Keep these names identical in the ads app so data can be pushed into `advertiser_reports` without translation.

## 4. Authorization rules to enforce (server-side, not only UI)
1. Resolve the user, then resolve role for the ACTIVE workspace (founder -> all workspaces).
2. `superadmin`/`founder`: all clients in workspace. Others: filter by `client_assignments.user_id = current user`.
3. Every query filters by `workspace_id`; enable Supabase RLS with the same policy shape:
   `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())`, and write policies restricted by role.
4. Meta access tokens and ad-account ids are secrets: store per workspace (and per client if needed), server-side only,
   readable/writable by `superadmin`/`founder` only. Never send them to the browser.

## 5. What I want you to build
1. Shared identity: use the SAME Supabase project/auth (same `auth.users`, `workspaces`, `workspace_members`, `clients`,
   `client_assignments`) so users and roles are identical across both apps. Do not duplicate these tables. If the apps must use
   separate Supabase projects, stop and ask me before designing a sync.
2. A `getWorkspaceContext()` helper equivalent to the accounting app's, returning
   `{ userId, activeWorkspaceId, role, availableWorkspaces }`, plus `getVisibleClients()` implementing rule 2.
3. New tables (ask me before creating): `meta_ad_accounts` (workspace_id, client_id, meta_ad_account_id, currency, status),
   and a token store with the access rules in section 4.
4. Sync job: pull spend / ROAS per ad account per day and write to `advertiser_reports` rows for the right
   `client_id`, `report_date`, `session`, in the `inkubasi`/`group`/`mandiri` structure above (mapping rules to be confirmed with me).
5. Tests for: founder sees all, advertiser sees only assigned clients, accounting cannot see tokens, cross-workspace isolation.

Ask me about anything ambiguous (especially mapping Meta campaigns to Inkubasi / Group / Mandiri and Hero / Reguler / Low) instead of guessing.
