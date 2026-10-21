# Prompt for Claude Code (paste into the reline.profesoronline.id project, "Dashboard Reline/next-app")

Our accounting ERP (accounting.profesoronline.id) must show, per day, what each Admin uploaded in this app (the Upload page), so the ERP can act as the admins' to-do list and show who did NOT upload. Add ONE read-only API endpoint for it. Inspect the current code first (the `uploads` table in every workspace schema, how `uploaded_by` and `meta` are stored, the `profiles` roles), then propose a short plan and wait for my approval before changing code or the database.

## Context
- This app has three workspaces, each its own Postgres schema (see `src/lib/workspace.ts`): Reline Project 1.0 = `public`, Panasonic Light Solution = `ws_light`, Alpha Project = `ws_alpha`. The endpoint must cover ALL THREE. Query each schema with `createAdminClient(schema)`.
- "Admin" = a profile with role `client_admin` (labelled "Admin" on the Users page). `profiles` is shared (public schema).
- There is already a similar endpoint in the sister project (Dashboard Profesortokoonline, `src/app/api/erp/upload-log/route.ts`, with a test). Use it as the model for auth, validation and response shape.

## Endpoint
`GET /api/erp/upload-log?from=YYYY-MM-DD&to=YYYY-MM-DD`

- `from` / `to` are inclusive calendar days in **Asia/Jakarta** time (fixed +07:00). Reject invalid dates or ranges longer than 60 days with 400.
- **Auth:** header `Authorization: Bearer <ERP_API_KEY>`. Compare with env var `ERP_API_KEY` using a constant-time comparison (hash both with SHA-256, then `timingSafeEqual`). Missing or wrong key -> 401 with an empty body. If the env var is not set, always 401. Never accept the key in the query string.
- **Login middleware:** right now `/api/erp/*` is redirected to `/login` (307). Exempt `/api/erp/` from the login/session middleware (like the sister project does), otherwise the ERP only ever sees a redirect.
- Read-only: no writes, no side effects. Do not expose file contents, storage URLs, user emails or other columns than those below. Server-side admin client only; no public/anon RLS policy.
- `Cache-Control: no-store`. No CORS headers (the ERP calls it from its server).

## Response 200
```json
{
  "generatedAt": "2026-10-21T02:00:00.000Z",
  "timezone": "Asia/Jakarta",
  "admins": [
    { "name": "Vani", "workspaces": ["Reline Project 1.0", "Alpha Project"], "stores": ["Store A", "Store B"] }
  ],
  "uploads": [
    {
      "id": "string, stable and unique (for example workspace + upload group key, hashed)",
      "uploadedAt": "2026-10-20T08:07:00.000Z",
      "type": "Store Performance",
      "admin": "Vani",
      "workspace": "Reline Project 1.0",
      "store": "Store A",
      "month": "October",
      "files": ["performance oct.csv"],
      "tags": ["Store Performance"]
    }
  ]
}
```
- `admins`: every active profile with role `client_admin`, even with zero uploads in the range (the ERP shows who did NOT upload). Include the workspaces they can use and the stores they handle if the data allows. Exclude deactivated users. If the same person exists in several workspaces, return ONE entry with all their workspaces.
- `uploads`: every upload in the range from ALL THREE workspaces, newest first. `uploadedAt` is a full ISO UTC timestamp. `type` is what the Upload page calls the upload (for example "Store Performance", "Ads Performance", "Earning", "Orders"; use the names the Upload page shows). `admin` = the display name of `uploaded_by` (the person who uploaded, falling back to the `meta` admin/pic name). `workspace` = the workspace NAME (not the schema). Group files of the same upload (same type + store + period + admin) into one entry like the on-screen Upload history does. Deleted uploads must not appear.
- Keep `admin` accurate for every uploader (not only `client_admin`) so the ERP can match by name. Tell me if you chose differently.

## Also
- Add `ERP_API_KEY` to `.env.example` and a short note on how to rotate it.
- Add a test: no key -> 401, wrong key -> 401, valid key -> 200 with the shape above, range > 60 days -> 400, and an upload from a non-default workspace appears with the right `workspace`.
- Tell me the value to put in the ERP's Vercel env as `RELINE_API_KEY` (I will generate a long random string myself; do not commit it).
- Show me the diff and wait for my OK before pushing.
