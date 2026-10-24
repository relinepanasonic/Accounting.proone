# Prompt for Claude Code (paste it into the dashboard.profesoronline.id chat, then into the reline.profesoronline.id chat)

Our accounting ERP (erp.profesoronline.id) gets a new Advertiser Dashboard that shows the store performance of this app next to the other app (Profesor Dashboard reports per **store**, Reline reports per **dealer**). Add ONE read-only API endpoint for it, with the numbers this app already shows on its own dashboard (Panasonic Sales, Total GMV, Traffic, In-Cart, Ads Cost, ROAS, GMV Max Auto / Group Ads / Independent Ads, Sales by Ads Type, Ads Funnel, Product Funnel, Baseline vs Active). Inspect the current code first (which tables and uploads feed those cards and charts, and how they are computed), then propose a short plan, including which column feeds each field below, and wait for my approval before changing code or the database.

## Endpoint
`GET /api/erp/performance?from=YYYY-MM-DD&to=YYYY-MM-DD`

- `from` / `to` are inclusive calendar days in **Asia/Jakarta** time. Accept ranges up to 370 days (the ERP asks for a whole year at once); longer -> 400.
- **Auth:** header `Authorization: Bearer <ERP_API_KEY>`, the same env var and the same rules as `/api/erp/upload-log`: constant-time compare, missing or wrong key -> 401 with no details, env var not set -> always 401, never accept the key in the query string. `/api/erp/*` must skip the login middleware.
- Read-only, server-side database client only, no public/anon RLS policy. Send `Cache-Control: no-store`. No CORS headers.
- Do not expose emails, file contents, storage URLs, or anything not listed below.

## Response 200
```json
{
  "generatedAt": "2026-10-25T02:00:00.000Z",
  "timezone": "Asia/Jakarta",
  "rows": [
    {
      "store": "Toko Elektronik A",
      "periodStart": "2026-09-01",
      "periodEnd": "2026-09-07",
      "granularity": "week",
      "sales": 11000000,
      "gmv": 15500000,
      "traffic": 52254,
      "addToCart": 1992,
      "orders": 71,
      "itemsSold": 238,
      "productViews": 52254,
      "productClicks": 4100,
      "baselineSales": 6000000,
      "activeSales": 11000000,
      "ads": {
        "gmvMax":      { "cost": 796100,  "sales": 11000000, "views": 52254,  "clicks": 1992,  "addToCart": 300, "orders": 71,  "itemsSold": 238 },
        "group":       { "cost": 4200000, "sales": 66600000, "views": 305201, "clicks": 14363, "addToCart": 900, "orders": 767, "itemsSold": 2470 },
        "independent": { "cost": 0,       "sales": 0,        "views": 0,      "clicks": 0,     "addToCart": 0,   "orders": 0,   "itemsSold": 0 }
      }
    }
  ]
}
```

### Rules for the rows
- **One row per store per period.** Profesor Dashboard: `store` = the store name (no owner, city or brand manager). **Reline: `store` = the dealer name** (one row per dealer per period; no city, no brand manager, no other grouping).
- Use the finest period your data really has: `granularity` is `"day"`, `"week"` or `"month"`, with `periodStart` / `periodEnd` (inclusive). The ERP sums the rows into months (year view) and into weeks 1-7, 8-14, 15-21, 22-28, 29-31 (month view) by `periodStart`, so a week should not cross two months if you can avoid it.
- Return every store / dealer that has data in the range, sorted by `periodStart` then `store`.
- **Field meanings** (use the same definitions as this app's own dashboard, and say in your plan which column you used):
  - `sales`: Panasonic sales (ready to ship) of the store. `gmv`: total GMV, all brands.
  - `traffic`: store traffic / visitors. `addToCart`: add to cart (In-Cart). `orders`, `itemsSold`.
  - `productViews`, `productClicks`: the product funnel (product page views, clicks). Use 0 when the app has no such data.
  - `baselineSales` / `activeSales`: the two lines of the "Baseline vs Active" chart (sales without and with the active campaign), as this app computes them. Use 0 when the app has no such chart.
  - `ads.gmvMax`, `ads.group`, `ads.independent`: GMV Max Auto, Group Ads and Independent Ads. For each: ad `cost`, ad `sales`, `views` (impressions), `clicks`, `addToCart`, `orders`, `itemsSold`.
- All numbers are plain numbers (Rupiah without dots). **No negative numbers**: if a value is derived as "total minus the others" and comes out negative, fix the derivation or return 0, and tell me (the current dashboard shows Independent Ads as -Rp 5 jt and sales -Rp 77,6 jt for September, which cannot be right).

## Also
- A test: no key -> 401, wrong key -> 401, valid key -> 200 with the shape above, range over 370 days -> 400, a store with no data in the range is not listed, no negative numbers.
- Nothing to change in the ERP env: it reuses `DASHBOARD_API_KEY` (Profesor Dashboard) and `RELINE_API_KEY` (Reline), which already work for `/api/erp/upload-log`.
- If you need a different shape (extra field, different period), do not work around it: write me the exact change and I will pass it to the ERP.
