---
name: OptimasiShopee
description: Shopee ads optimisation advice (GMV Max Auto, Group Hero / Regular / Low Konversi, Iklan Mandiri). Use when the user gives or asks about Shopee ad figures (modal harian, biaya iklan, penjualan, ROAS) and wants to know what to do next. Same rules as src/lib/advertiser/optimasi.ts.
---

# OptimasiShopee

Turn one day's Shopee ad figures into one clear action per group / ad. Answer in Bahasa Indonesia, short, as a table. Do not explain the rules back to the user.

## Words and thresholds

- **GMV Max Auto** = the old "Inkubasi" campaign (stored as `inkubasi` in the app). Modal harian is usually Rp 50.000, target ROAS is Auto.
- **Usage** = biaya iklan / modal harian.
- **Maxed out** = usage >= 99% (biaya iklan reached the modal harian, e.g. 25k of 25k). **Low** = usage < 70% (e.g. 65k of 100k). Between 70% and 99% = "Pantau", no action. (Constants `MAXED_AT` and `LOW_BELOW` in `optimasi.ts`.)
- **ROAS** of a group = total penjualan / total biaya iklan of that group (never an average of row ROAS values).
- **Average ROAS of the store** = total penjualan / total biaya iklan of EVERY ad: GMV Max Auto + all Group Ads + Iklan Mandiri. This equals the ROAS Shopee shows for the whole store (Performa > Iklan Produk).
- "Above" = ROAS >= average. No spend (biaya 0) counts as below.
- One decision per **group** (Group Hero 1, Group Hero 2 ...), one per **Iklan Mandiri** ad, one per **GMV Max Auto** product.

## GMV Max Auto

If a product's usage is maxed out (read the day's result; in session 1 that is yesterday's result):
**"Check apakah ada produk yang dapat dikeluarkan dari GMV Max Auto?"**
Add the stamp "hari ke-N": how many days in a row it has been maxed out (day 1 = first day, N grows each consecutive day; a day that is not maxed, or missing, resets it).

## Group Ads and Iklan Mandiri

| Section | Maxed + ROAS above avg | Maxed + ROAS below avg | Low + ROAS above avg | Low + ROAS below avg |
|---|---|---|---|---|
| **Group Hero** (best, aggressive) | Naikkan Modal Harian! | Naikkan Target ROAS! | Turunkan Target ROAS! | Lihat Detail Produk; buang yang jelek! |
| **Group Regular** (defensive) | Pindahkan Produk yang bagus ke Group HERO! | Naikkan Target ROAS! | STAY! | Pindahkan Produk Jelek ke Low Konversi! |
| **Group Low Konversi** | STAY! | Hapus Produk yang Boncos! | STAY! | Hapus Produk yang Boncos! |
| **Iklan Mandiri** (per ad) | Naikkan Modal Harian! | Naikkan Target ROAS! | Turunkan Target ROAS! | Kembali ke Group Hero! |

## How to answer

1. Compute the store average ROAS from the groups. State it once.
2. For each group / ad: usage %, ROAS, above/below, then the action from the table.
3. Order: GMV Max Auto, Hero, Regular, Low, Mandiri. Put anything that is not "STAY!" first inside each section.
4. If a number is missing, say which one and give the advice for the rest.

The app shows the same advice automatically on Advertiser > Log (column Recommendation, full list in the day's detail).
