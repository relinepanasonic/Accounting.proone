# Prompt for Dashboard Prof and Reline: "Send weekly report to client group (Oli)"

Paste the text below into the Claude chat of **each** project (Dashboard Prof, and Reline). Only the `source` value differs.

---

The ERP now sends the weekly client report (a one-page image) to the client's WhatsApp group from Oli's number. The admin who uploads the weekly numbers is the one who pushes the button. Please add it.

**What to build**

1. On the store's weekly page (and right after the admin finishes the weekly upload), add a gold button **"Send weekly report to client group (Oli)"**.
2. Clicking it first calls the ERP with `action: "preview"`. Show the returned image (`imageUrl`), the week, the group name and the caption in a confirm dialog. The admin presses **Send**, which calls the ERP again with `action: "send"`.
3. Show the result: sent (with time), or the error message from the ERP.
4. Disable the button and show "This client has no WhatsApp group yet. Link it in the ERP (Optimizing > Clients)" when the ERP answers `409 no_group`.
5. On `409 already_sent` show "Already sent on <sentAt>" and offer a **Send again** button that repeats the call with `resend: true`.
6. Always call the ERP **from the server** (route handler or server action). The key must never reach the browser.
7. Pass `sentBy` with the logged-in admin's name.

**The ERP endpoint**

```
POST https://erp.profesoronline.id/api/v1/erp/wa/client-weekly
Authorization: Bearer <ERP_API_KEY>        (the same ERP_API_KEY value already used for /api/erp/performance)
Content-Type: application/json
```

Body:

```json
{
  "source": "dashboard",            // Dashboard Prof = "dashboard", Reline = "reline"
  "store": "onat.hardware",         // the store name as in the performance data (Reline: the dealer name)
  "workspace": "",                  // Reline: the workspace name, e.g. "Reline Project 1.0"
  "week": "2026-11-02",             // optional: the Monday of the week. Default: the last full week
  "action": "preview",              // "preview" or "send"
  "resend": false,                  // true only for "Send again"
  "sentBy": "Vani"                  // optional: who pressed the button
}
```

Answers:

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ ok: true, store, label, client, week: {from,to}, group, status, caption, imageUrl }` (+ `sent: true, detail` after a send) | Preview ready or report sent. `imageUrl` is valid for 1 hour. |
| 400 | `{ error: "bad_request", message }` | Fix the body. |
| 401 | empty | Wrong or missing key. |
| 404 | `{ error: "no_data", message }` | No numbers for that store and week yet. Upload first. |
| 409 | `{ error: "no_group" }` | The client has no WhatsApp group linked. |
| 409 | `{ error: "already_sent", sentAt }` | Already sent. Allow `resend: true`. |
| 502 | `{ error: "send_failed", message }` | WhatsApp refused. Show `message`. |

Rules: the store name must match the one in the performance data exactly (the ERP matches it the same way it does for `/api/erp/performance`). Do not retry a `send` automatically. A second click is a deliberate "Send again".

---
