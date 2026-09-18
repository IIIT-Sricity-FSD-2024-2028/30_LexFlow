# 05 — Routing (hand-rolled hash router)

**File:** `src/router.jsx` — ~70 lines, zero dependencies.

## How it works

URLs look like `index.html#/client/cases/12`. The part after `#` is the route.

| Export | What it does |
|---|---|
| `useRoute()` | Hook returning the current path (e.g. `/client/cases/12`). Re-renders on `hashchange`. |
| `navigate(path)` | Sets `window.location.hash`; no-ops if already there. |
| `<Link href="/x">` | Normal `<a>` with the `#` prefix — middle-click/new-tab still work. |
| `matchRoute(path, pattern)` | Pattern matcher: `/client/cases/:id` matches `/client/cases/12` → returns `{ id: '12' }`, or `null`. |
| `segments(path)` | Splits a path into parts (used by `matchRoute`). |

## The route table (`App.jsx`)

`App.jsx` is one `if / else if` chain that maps the current path to a component.
Reading it top-to-bottom IS the site map:

```
Public
  /                          Landing
  /signin                    SignIn
  /onboarding/client/1|2     Client sign-up (2 steps)
  /onboarding/firm/1|2|3     Firm sign-up (3 steps)

Client portal    (roles: client)
  /client/dashboard          Consultations overview
  /client/search             Find a Law Firm
  /client/cases              My Cases
  /client/cases/:id          Case details   (:id = case id OR CNR)
  /client/advocate/:id       Advocate profile
  /client/billing            Invoices
  /client/billing/pay/:id    Checkout
  /client/transactions       All payments
  /client/chat[/:consId]     Chat room

Firm portal      (roles: firmadmin, lawyer, intern)
  /firm/dashboard            Requests + accept/reject/convert
  /firm/cases                Cases + Pending-tasks tabs
  /firm/cases/:id            Case management  (:id = id OR CNR)
  /firm/tasks                Task CRUD
  /firm/billing              Invoices + subscription (intern blocked)
  /firm/users                User management (firmadmin only)
  /firm/chat[/:consId]       Lawyer side of the chat

Shared (any signed-in role; data is role-scoped by the backend)
  /documents                 Document hub
  /documents/:caseId         Per-case documents
  /activity-log              Audit trail
  /schedule                  Schedules (firm staff)

Superadmin      (role: superadmin)
  /superadmin/dashboard | revenue | firms | lawyers | users
  /superadmin/consultations | invoices | settings
```

## The guard

Each portal page is wrapped in `<Layout roles={[...]}>`:

```jsx
useEffect(() => {
  if (!user) navigate('/signin');                       // 1. not logged in
  else if (roles.length && role !== 'superadmin'
        && !roles.includes(role))                        // 2. wrong role…
    navigate(dashboardPathFor(role));                    //    → own dashboard
}, [user, roles]);
```

**superadmin bypasses every role list** — the same rule the vanilla app had.
`dashboardPathFor()` is the single source of truth for "which dashboard does each
role land on".

## Why hash routing (viva answer)

1. Zero dependencies (requirement).
2. Works from any static host — no server rewrites for deep links.
3. The vanilla app's inter-page links were plain `.html` files; `#` routes map
   1-to-1 to that mental model.
