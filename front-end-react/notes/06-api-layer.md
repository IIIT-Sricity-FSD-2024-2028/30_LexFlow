# 06 — The API Layer

**File:** `src/api/api.js` — the *only* place that talks to the backend.

The vanilla app had three overlapping HTTP helpers (`api.js`, `billing-storage.js`,
`cases-storage.js`). They are merged here into one exported `api` object.

## 1. Base URL & proxy

```js
export const BASE_URL = '/api';
```

In dev, `vite.config.js` proxies `/api/*` → `http://localhost:3000/*` (stripping
the prefix). Same origin = no CORS, cookies just work.

## 2. The `request()` helper — every call flows through it

```js
async function request(method, path, { body, role, extraHeaders, formData })
```

It attaches, in order:

| Header | Source | Why |
|---|---|---|
| `Content-Type: application/json` | automatic (skipped for FormData) | file uploads need the browser's multipart boundary |
| `role` | the `role` argument | backend scopes every query by role |
| `Authorization: Bearer <token>` | `localStorage.access_token` | JWT auth |
| `x-csrf-token` | the `x-csrf-token` **cookie** value | double-submit CSRF on mutations |

plus `credentials: 'include'` so the session cookie rides along.

**Error handling:** non-2xx throws an `Error` carrying `.status` and `.data`;
array messages (class-validator output) are joined into one string. Pages just
do `catch (err) → toast(err.message)`.

**Response unwrapping:** endpoints that answer `{ data: [...] }` are unwrapped
automatically, so pages always deal with the payload itself.

## 3. Endpoint map (namespaces)

```js
api.auth        login(email, password)
api.consultations  getMy / getAll / getById / create / update / cancel / remove / getWorkflowBookings
api.users       getAll / getById / getByFirm / getLawyers / getAllFirms
                create / update / remove
                startOnboarding / onboardingStep1|2|3      ← firm wizard
                createFirm / updateFirm / deleteFirm       ← superadmin
api.cases       getAll / getById / create / update / remove
api.tasks       getAll / create / update / remove
api.lawFirms    getAll / getById                           ← client directory
api.billing     getInvoices / getInvoice / createInvoice / updateInvoice / deleteInvoice
                getPayments / recordPayment / getClients
api.platform    getRevenueSummary / getMonthlyRevenue / getRevenueByFirm
                getSubscriptions / getSubscription / requestTierChange
                getCharges / updateChargeStatus
                getTierPlans / updateTierPricing / getSettings / updateSettings
api.documents   listByCase / upload / update / remove / getActivity / logActivity
```

## 4. Usage examples

```js
// simple GET
const list = await api.cases.getAll({ clientId: user.id }, 'client');   // GET /cases?clientId=…

// POST with body
await api.consultations.create(payload, 'client');                      // POST /consultations

// multipart upload (FormData built for you)
await api.documents.upload(file, { caseId, type: 'CONTRACT', … }, role, email);

// fire-and-forget audit entry (logging never breaks the page)
api.documents.logActivity(entry, role, email);
```

## 5. Where identity comes from

`getCurrentUser()` reads `localStorage.currentUser` (written by sign-in /
onboarding). Pages use `user.id`, `user.firmId`, `user.email` — with the same
fallbacks the vanilla code had (`id || userId || clientId`,
`fullName || name`).

## 6. Billing headers

The billing endpoints expect the caller's identity in headers (as the vanilla
`billing-storage.js` did): `x-user-id` and `x-user-name`. Pages pass them via the
`extraHeaders` argument.
