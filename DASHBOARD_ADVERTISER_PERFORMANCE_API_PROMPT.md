# Prompt for Claude Code (paste into the dashboard.profesoronline.id project, then the same idea in the reline.profesoronline.id project)

Our ERP (erp.profesoronline.id) sends a WhatsApp weekly report. For the Advertiser part it needs, per advertiser and per client store, the GMV and the ads budget (ad spend) of a period. Add ONE read-only API endpoint for it. Inspect the current code first (which tables hold the ads performance and store performance numbers shown on the dashboard, how a store is tied to an advertiser / PIC, and how "GMV" and "Biaya Iklan / Budget Ads" are stored), then propose a short plan and wait for my approval before changing code or the database.

## Endpoint
`GET /api/erp/advertiser-performance?from=YYYY-MM-DD&to=YYYY-MM-DD`

- `from` / `to` are inclusive calendar days in **Asia/Jakarta** time. Reject ranges longer than 62 days with 400.
- **Auth:** header `Authorization: Bearer <ERP_API_KEY>` (the same env var and the same rules as `/api/erp/upload-log`: constant-time compare, missing or wrong key -> 401 with no details, env not set -> always 401, never accept the key in the query string).
- Read-only, server-side database client only, no public/anon RLS policy. Send `Cache-Control: no-store`.
- Do not expose emails, file contents or storage URLs.

## Response 200
```json
{
  "generatedAt": "2026-10-26T02:00:00.000Z",
  "timezone": "Asia/Jakarta",
  "from": "2026-10-01",
  "to": "2026-10-25",
  "advertisers": [
    {
      "name": "Devy",
      "gmv": 125000000,
      "adSpend": 18000000,
      "stores": [
        { "store": "studio.blair", "client": "Studio Blair", "gmv": 52000000, "adSpend": 7000000, "roas": 7.43 }
      ]
    }
  ]
}
```
- `gmv` = total sales (GMV) of the store in the period; `adSpend` = total ads budget spent (Biaya Iklan) in the period; `roas = gmv / adSpend` (null when adSpend is 0). Use the same definitions as the dashboard pages, and say in your plan which columns you used.
- `advertisers[].name` is the advertiser / PIC who handles the store. A store without an advertiser goes under the name `"(no advertiser)"`.
- `advertisers[].gmv` and `adSpend` are the sums of their stores.
- Include an advertiser even when the numbers are 0.

## Also
- Add a test: no key -> 401, wrong key -> 401, valid key -> 200 with the shape above, range > 62 days -> 400.
- Tell me nothing to change in the ERP env: the ERP reuses `DASHBOARD_API_KEY` (or `RELINE_API_KEY` for Reline).
