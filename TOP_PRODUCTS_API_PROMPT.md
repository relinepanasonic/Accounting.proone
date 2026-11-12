# Prompt for Claude Code (paste it into the dashboard.profesoronline.id chat, then into the reline.profesoronline.id chat)

Our accounting ERP (erp.profesoronline.id) sends every client a weekly report as a 2-page PDF. Page 2 is the **10 best-selling products of the store in that week** (like the "10 Produk Terlaris" page of this app's own monthly PDF report) and a short analysis. Add ONE read-only API endpoint with that data. Inspect the current code first (how the monthly PDF's "10 Produk Terlaris" is computed: which table or upload feeds it, which column is the product name and which one the sales), then propose a short plan, including which column feeds each field below, and wait for my approval before changing code or the database.

## Endpoint
`GET /api/erp/top-products?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=10`

- `from` / `to` are inclusive calendar days in **Asia/Jakarta** time. A week is Monday to Sunday. Accept ranges up to 62 days; longer -> 400.
- `limit` is the number of products per store (default 10, max 20).
- **Auth:** header `Authorization: Bearer <ERP_API_KEY>`, the same env var and the same rules as `/api/erp/upload-log` and `/api/erp/performance`: constant-time compare, missing or wrong key -> 401 with no details, env var not set -> always 401, never accept the key in the query string. `/api/erp/*` must skip the login middleware.
- Read-only, server-side database client only, no public/anon RLS policy. Send `Cache-Control: no-store`. No CORS headers.
- Do not expose emails, file contents, storage URLs, or anything not listed below.

## Response 200
```json
{
  "generatedAt": "2026-11-16T02:00:00.000Z",
  "timezone": "Asia/Jakarta",
  "from": "2026-11-09",
  "to": "2026-11-15",
  "stores": [
    {
      "store": "onat.hardware",
      "workspace": "",
      "products": [
        { "name": "L3O Kawat Loket PVC RAM Ayakan 1/2 \" ECO L30", "sales": 51601692 },
        { "name": "ONAT Roda Caster Nylon PU PVC Orange 3 Inch REM Medium Duty", "sales": 22578657 }
      ]
    }
  ]
}
```

### Rules
- **One entry per store** that has product sales in the range. Profesor Dashboard: `store` = the store name, exactly as `/api/erp/performance` writes it. **Reline: `store` = the dealer name, and `workspace` = the Reline workspace**, exactly as `/api/erp/performance` writes them (the ERP matches a store's products by `store` + `workspace`, so they must be identical to that endpoint).
- `products`: the best sellers of that store in the range, **sorted by `sales` descending**, at most `limit`. Use the same definition of product "sales" as the monthly PDF's "10 Produk Terlaris" page, and say in your plan which column you used.
- `name`: the product name as the app shows it. Trim whitespace; do not cut it (the ERP shortens it when it draws it).
- `sales` is a plain number (Rupiah without dots), never negative. Leave out a product with no sales.
- A store with no product data in the range is simply not listed.
- If the app only has product data per **month** (not per week or day), tell me instead of returning a month for a week: write me the exact change you need and I will pass it to the ERP.

## Also
- A test: no key -> 401, wrong key -> 401, valid key -> 200 with the shape above, range over 62 days -> 400, a store without sales in the range is not listed, products are sorted, no negative numbers.
- Nothing to change in the ERP env: it reuses `DASHBOARD_API_KEY` (Profesor Dashboard) and `RELINE_API_KEY` (Reline).
- If you need a different shape (extra field, different period), do not work around it: write me the exact change and I will pass it to the ERP.
