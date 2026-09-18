# 03 — Shared Components

Everything in `src/components/` is reused by multiple pages. Learn these once and
every page becomes readable.

## `ui.jsx` — the UI kit

| Component | Purpose | Key props |
|---|---|---|
| `Button` | Every button in the app. 5 variants: `primary` (navy), `outline`, `ghost`, `danger`, `gold`. Shows a spinner when `loading` is true. | `variant`, `loading`, `onClick` |
| `Card` | White rounded panel. Spreads extra props, so `<Card onClick={...}>` works. | `className` |
| `Badge` / `StatusBadge` | Coloured pills. `StatusBadge` maps ANY status word (`PAID`, `Ongoing`, `CANCELLED`…) to green/amber/red/blue automatically. | `variant`, `status` |
| `Avatar` | Circle with a person's initials. | `name`, `className` |
| `Modal` | Centered dialog with dark overlay. Closes on ✕, backdrop click, and Escape. Locks page scroll while open. | `open`, `onClose`, `title`, `wide`, `footer` |
| `Field` | Label + red error text wrapper for any input. | `label`, `error`, `required` |
| `Input` / `Select` / `Textarea` | Consistent form controls; red styling when `error` is set. | `error`, …native props |
| `Table` / `Th` / `Td` | Consistent table styling. `Td` accepts `colSpan` for empty-state rows. | — |
| `PageHeader` | Big title + subtitle + action buttons row. | `title`, `subtitle`, `actions` |
| `StatCard` | The "4 KPI cards" row used on dashboards. | `label`, `value`, `icon`, `tone` |
| `Pagination` | "Showing X–Y of Z" + numbered page buttons. | `page`, `pages`, `total`, `perPage`, `onPage` |
| `Tabs` | Segmented tab bar with an optional counter badge. | `tabs`, `active`, `onChange` |
| `FilterDropdown` | "Filters" button that opens a small popover; closes on outside click. | `children` |
| `EmptyState` | Dashed grey box for "nothing here" + optional action button. | `icon`, `title`, `action` |
| `Loading` | Centered spinner with a caption. | `text` |
| `ErrorBanner` | Red error box with an optional Retry button. | `message`, `onRetry` |
| `Spinner` | The raw spinner (used inside `Button` too). | `size`, `light` |

### Client-side pagination pattern (used on 5+ pages)

```jsx
const PER_PAGE = 5;
const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
<Pagination page={page} pages={pages} total={filtered.length} perPage={PER_PAGE} onPage={setPage} />
```

## `Layout.jsx` — page shell + auth guard

Wraps every dashboard page. Two jobs:

1. **Guard** (replaces vanilla `AuthService.requireAuth`):
   - no user → `#/signin`
   - role not in `roles` (and not superadmin) → that role's dashboard
2. **Shell**: renders `<Sidebar/>`, a mobile hamburger bar, and the
   `max-w-7xl` content column.

Also exports `Breadcrumb` ("Cases / CNR: 123456") for detail pages.

```jsx
// App.jsx usage — only clients (and superadmin, who bypasses) can enter:
<Layout roles={['client']}><ClientDashboard/></Layout>
```

## `Sidebar.jsx` — role-aware navigation

- Picks its link list from the signed-in role:
  - **client** → Consultations, Cases, Documents, Billing, Find a Law Firm
  - **firm staff** → Consultations, Cases, Documents, Billing, User Management
    - interns: Billing hidden; User Management: firmAdmin only
  - **superadmin** → Overview, Revenue, Law Firms, Lawyers, Users, Consultations, Invoices, Settings
- Highlights the active link (URL starts-with match).
- Fetches the firm's **tier badge** for firm staff (`GET /users/firms/all`).
- Logout button → `signOut()` from AppContext → back to landing.

## `Calendar.jsx` — mini month calendar

One component, two uses:
- **Booking modal** (client): `disablePast` greys out past days, `onPick` receives the chosen `Date`.
- **Schedule page**: browse-only, `dots` colours days that have events.

Builds a 6×7 grid: leading days from the previous month, the month itself,
trailing days to fill 42 cells. Prev/next buttons handle year rollover.

## `Icon.jsx` — all icons in one map

No icon library. A `PATHS` object maps names to SVG shapes;
`<Icon name="search" size={16}/>` renders one. Adding an icon = adding one map entry.

## `lib/format.js` — formatting helpers

| Function | Output example |
|---|---|
| `money(123456.5)` | `₹1,23,456.50` (Indian locale) |
| `moneyShort(21000000)` | `₹2.1Cr` |
| `formatDate(v)` | `15 Aug 2026` (safe with bad dates) |
| `formatDateTime(v)` | `15 Aug 2026, 14:05` |
| `initials("Priya Sharma")` | `PS` |
| `roleLabel("firmadmin")` | `Firm Admin` |

## `lib/validators.js` — form rules

Every validator **returns an error string, or `null` when valid** — trivially
composable:

```jsx
const error = validateEmail(value);       // null | "Enter a valid email address."
```

Includes: name/firm-name, email, Indian mobile (handles `+91`/`0` prefixes),
6-digit PIN, street/city/state, password (4-of-5 rules + `passwordScore`),
confirm-password, optional website URL, `normalizeIndianPhone`.

`src/lib/validators.check.js` is a runnable self-check for all of these:
`npm run check`.
