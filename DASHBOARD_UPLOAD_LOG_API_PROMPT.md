# Prompt for Claude Code (paste into the dashboard.profesoronline.id project)

Our accounting ERP (accounting.profesoronline.id) must show, per day, what each admin uploaded in this app (the "Upload Data" page: Ads Performance and Store Performance uploads). Add ONE read-only API endpoint for it. Inspect the current code first (which table holds the upload history shown on /upload, and how admin, owner, store, type, month, week and files are stored), then propose a short plan and wait for my approval before changing code or the database.

## Endpoint
`GET /api/erp/upload-log?from=YYYY-MM-DD&to=YYYY-MM-DD`

- `from` / `to` are inclusive calendar days in **Asia/Jakarta** time. Reject ranges longer than 60 days with 400.
- **Auth:** header `Authorization: Bearer <ERP_API_KEY>`. Compare with an env var `ERP_API_KEY` using a constant-time comparison. Missing or wrong key -> 401 with no body details. If the env var is not set, always answer 401. Never accept the key in the query string.
- Read-only: no writes, no side effects. Do not expose file contents, storage URLs, user emails or any other columns than those below.
- Use the server-side database client only. Do not add any public/anon RLS policy for this.
- Send `Cache-Control: no-store`. No CORS headers needed (the ERP calls it from its server).

## Response 200
```json
{
  "generatedAt": "2026-09-30T05:00:00.000Z",
  "timezone": "Asia/Jakarta",
  "admins": [
    { "name": "Adelia", "stores": ["studio.blair"] },
    { "name": "Olga", "stores": ["apotikunion288"] }
  ],
  "uploads": [
    {
      "id": "string, stable and unique",
      "uploadedAt": "2026-09-28T08:07:00.000Z",
      "type": "Ads Performance",
      "admin": "Adelia",
      "owner": "Adelia",
      "store": "studio.blair",
      "month": "September",
      "week": "All",
      "files": ["studio ads sep week 3.csv", "studio ads grup sep week 3.csv"],
      "tags": ["Group", "Inkubasi"]
    }
  ]
}
```
- `uploadedAt` is a full ISO-8601 UTC timestamp (the "TIME UPLOAD" column). `type` is exactly what the Upload page shows ("Ads Performance", "Store Performance").
- `admin` is the person who uploaded; `owner` and `store` are the store owner and store name.
- `files` are file NAMES only.
- `admins` is the list of active admins who are expected to upload (with the stores they handle). Include an admin even if they uploaded nothing in the range, because the ERP uses this list to show who did NOT upload. Exclude deactivated users.
- Sort `uploads` by `uploadedAt` descending. Deleted uploads (the Delete button) must not appear.

## Also
- Add the env var to `.env.example`, and write a short note on how to rotate `ERP_API_KEY`.
- Add a test: no key -> 401, wrong key -> 401, valid key -> 200 with the shape above, range > 60 days -> 400.
- Tell me the value to put in the ERP's Vercel env as `DASHBOARD_API_KEY` (I will generate a long random string myself; do not commit it).
