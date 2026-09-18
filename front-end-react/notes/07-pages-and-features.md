# 07 — Pages & Features (by role)

Every screen in the app, with its features. Route guards are listed per section.

## Public

### Landing (`pages/Landing.jsx`) → `/`
- Header with anchor links + **"Login" dropdown** → choose Client / Law Firm /
  Intern → remembers `loginRole` → sign-in page.
- Hero with "Request Consultation" CTA (logged-in clients skip to dashboard).
- Features grid, pricing (3 tiers → firm onboarding), How-it-works,
  security card, law-firm CTA, footer with newsletter form.

### Sign-in (`pages/SignIn.jsx`) → `/signin`
- Reads `loginRole` to know which portal this is; the **Sign up** link points to
  the matching onboarding.
- `POST /users/login` → stores JWT + user (via `AppContext.signIn`).
- Portal checks: client portal rejects firm staff and vice-versa.
- Redirects by role: client → client dashboard, staff → firm dashboard,
  superadmin → superadmin dashboard.

## Onboarding

### Client (2 steps) — `/onboarding/client/1|2`
- **Step 1:** 9-field profile form with live validation + **password strength
  meter** and a 5-rule checklist. Creates the user on the backend
  (`POST /users`), saves a draft in `sessionStorage.clientDraft`.
- **Step 2:** optional case details (or **Skip**). Signs the client in, clears
  the draft → client dashboard.

### Law firm (3 steps) — `/onboarding/firm/1|2|3`
- **Step 1:** firm info → starts a server session (`POST /users/firm-onboarding/start`)
  and submits step 1. `sessionStorage.firmDraft` + `firmOnboardingSessionId`.
- **Step 2:** primary contact (email / phone / website).
- **Step 3:** admin profile + **plan picker** (tiers fetched from
  `GET /platform/tiers`) + terms checkbox. Completes via
  `POST …/step3/{sessionId}` → signs the admin in → firm dashboard.
  (Fallback: direct `POST /users` when no session exists.)

## Client portal (guard: `client`)

### Consultations Dashboard → `/client/dashboard`
- Upcoming consultations as cards (status badge, date block, lawyer) and past
  ones in a table.
- **View Details** modal (fetches full record), **Cancel** (confirm dialog),
  **Join Chat** for confirmed ones.
- Empty states + retry banners on API failure.

### Find a Law Firm → `/client/search`
- Search bar + location / practice-area selects + sort (rating / price / reviews / availability).
- Firm cards with availability badges.
- **View Profile** modal (stats, practice areas, education, languages, contact).
- **Book Now** modal: firm name (read-only), chat/in-person toggle, **mini
  calendar** (past days disabled), 6 time slots, description →
  `POST /consultations` (payload includes `bookedViaWorkflow: true`) → redirect
  to dashboard.

### My Cases → `/client/cases`
- Live search (title/CNR), 3 per page, fade-free simple pagination, "Date Filed"
  chip on each card, View Details → case page.

### Case Details (client) → `/client/cases/:id`
- Accepts a case **id or CNR** (tries `GET /cases/:id`, falls back to list search).
- General info grid, next-hearing banner (big day/month), progress %,
  timeline, documents table with placeholder download.
- Assigned lawyer links to the advocate profile.

### Advocate Profile → `/client/advocate/:id`
- Real user from `GET /users/:id` + their active cases (`?lawyerId=`).
- Win-rate donut (SVG), performance stats, upcoming hearings, qualifications.

### Billing → `/client/billing`
- 4 summary cards (billed / paid / pending / overdue).
- Invoice table: search + All/Paid/Pending/Overdue tabs, due-date colouring
  (red overdue, amber ≤14 days), **Pay Now** per unpaid invoice.
- Payment history (3 most recent) with method icons.

### Pay Now → `/client/billing/pay/:id`
- Invoice summary card + card form (grouped 16-digit number, MM/YY expiry with
  not-expired check, CVC). Failed validation shakes the form; success
  (`POST /billing/payments/:id {paymentMethod:'Card'}`) shows a success panel
  then redirects.

### All Transactions → `/client/transactions`
- Full payment history, newest first, skeleton loading rows.

### Consultation Chat → `/client/chat[/:consId]`
- WhatsApp-style: chat list (one thread per lawyer), search, message bubbles,
  auto-scroll. Messages persist in `localStorage` under `lf_chat_<consultationId>`
  — so the client and lawyer see the same thread on the same machine.
- Client receives a canned lawyer reply after 1.5 s (demo behaviour from vanilla).
- "End Consultation" returns to the dashboard.

## Firm portal (guard: `firmadmin`, `lawyer`, `intern`)

### Firm Dashboard → `/firm/dashboard`
- 3 stat cards (pending / active / completed).
- **Incoming Requests** cards with a lawyer-assignment dropdown:
  **Accept** (`PATCH /consultations/:id {status:'CONFIRMED', lawyerId…}`) /
  **Reject** (`PATCH …/cancel`).
- **Active Consultations** table: Chat, **Convert to Case** (creates a case with
  a random 6-digit CNR, then marks the consultation COMPLETED), Cancel.

### Case List → `/firm/cases`
- Tabs: **All Cases** / **Pending Tasks** (with count badge).
- Search (placeholder changes per tab), status/priority/status filters in a
  dropdown, 4 per page.
- Case cards: inline lawyer reassignment, View Details.
- Task cards: priority/status pills, due-date highlighting (red = today), View Case.
- Lawyers see tasks filtered to `assignedUser = their name`.

### Case Management → `/firm/cases/:id`
- Header card with Edit Details + working **Export** (CSV download).
- Progress bar with 5 phases (Filing → Trial) highlighted by % bands.
- Client Details card (edit modal), Pending Tasks (checkbox completes,
  "+ Assign New Task" modal), Core Team (edit modal: remove/add members).
- **Editable timeline** (add / edit / delete events, upcoming badge).
- Document Management (upload modal with type/confidentiality/file, download,
  delete).

### Tasks → `/firm/tasks`
- Table with search + priority/status filters, 5 per page.
- **Create/Edit modal**: task name, Case ID/CNR resolver (matches id, CNR or
  title, and narrows assignees to that case's team), assignee, segmented
  priority toggle, due date, description.
- View modal with "Mark as Completed"; delete with confirmation.

### Firm Billing → `/firm/billing` (intern blocked)
- 4 summary cards; **Subscription Charges** table with Pay now;
- **Your Plan** card with tier-switch buttons (issues a one-time charge via
  `POST /platform/subscriptions/:firmId/tier-change`), shows pending tier.
- Invoice table (search + tabs + **create / edit / view / delete / print**
  — print uses a hidden invoice template + `window.print()`).
- Payment history table.

### User Management → `/firm/users` (guard: `firmadmin`)
- Zero-padded stat tiles, search, role filter, 8 per page.
- Add/Edit modal (role select hides "Firm Admin" unless editing an admin,
  account-status + availability toggles), delete, **JSON export**.

## Documents (any signed-in role; backend scopes data)

### Document Hub → `/documents`
- Role-scoped case list as grid or list view, live search, status filter
  (checkbox popover), sortable, "Manage Documents →" per case.

### Case Documents → `/documents/:caseId`
- **Access check** first: owner client, assigned lawyer, same-firm staff, or
  `caseAccess` grant — otherwise an "Access Denied" panel with the reason.
- Toolbar: search, type select, access filter, grid/list toggle, total count.
- Doc cards: type icon colour, SHARED/PRIVATE badge, version, uploader, date.
- **Upload** modal (type + file, 10 MB limit), **Update** modal (renames +
  bumps version, new file required), **View** modal (image preview or iframe),
  **Download**, **Delete** (confirmation).
- Every action writes an audit entry (`POST /documents/activity`).
- Interns only see `SHARED` documents.
- Side panel: recent activity + View All Activity (non-clients).

### Activity Log → `/activity-log`
- Audit table with user/action/document/access; search, 4 filters, newest-first
  sort toggle, clickable stat pills, 15/page pagination, **Export CSV**.

### Schedules → `/schedule` (firm staff)
- Month calendar with event dots + day timeline with positioned event blocks
  and legend; lawyer filter; **Add Event** modal that actually saves
  (localStorage) — the vanilla "Save Event" button was a no-op.

## Superadmin console (guard: `superadmin`)

| Page | Route | Features |
|---|---|---|
| Platform Overview | `/superadmin/dashboard` | Hero earnings card, 6 KPI cards, 6-month stacked bar chart, top-5 earning firms |
| Revenue | `/superadmin/revenue` | KPIs, chart with 6/12/24-month range, plan mix, earnings by firm, charges table with mark paid/unpaid |
| Law Firms | `/superadmin/firms` | Firm CRUD modal (with optional admin account), tier filter, inline mark-charge-paid, two-step cascade delete (400 → confirm → `?cascade=true`) |
| Lawyers & Interns | `/superadmin/lawyers` | Cross-firm roster, search/status filter, activate/deactivate |
| Users | `/superadmin/users` | All-account CRUD (password only on create) |
| Consultations | `/superadmin/consultations` | All bookings, cancel/delete, status filter (falls back to workflow-bookings endpoint) |
| Invoices | `/superadmin/invoices` | Paid-through-platform + **commission** KPIs (rate from settings), mark paid, delete |
| Settings | `/superadmin/settings` | Tier price editors (only changed tiers are PUT), business rules form (commission %, currency, support email, maintenance mode, disable signups) |

The chart lives in `pages/superadmin/Chart.jsx` and is shared by the dashboard
and revenue pages — two coloured divs per month sized by percentage, no library.
