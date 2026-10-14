# 01 — Frontend Architecture

## 1. The stack (and why)

| Layer | Choice | Why |
|-------|--------|-----|
| UI library | **React 18** | Component reuse, declarative rendering |
| Build tool | **Vite** | Instant dev server, zero-config JSX |
| Styling | **Tailwind CSS v4** | Utility classes replace ~30 CSS files from the vanilla app |
| State | **useContext** | The app only shares *user + toasts* globally — Redux would be overkill |
| Routing | **Custom hash router** (`src/router.jsx`) | No dependency needed; works on any static host |
| Runtime deps | `react`, `react-dom` — **that's all** | "No libraries" requirement |

## 2. The four layers

```
┌──────────────────────────────────────────────────────┐
│  Pages        src/pages/**       one file per screen │  ← data fetching + layout
├──────────────────────────────────────────────────────┤
│  Shared UI    src/components/**  Button, Modal, ...  │  ← reusable building blocks
├──────────────────────────────────────────────────────┤
│  State        src/context/**     AppContext (user,   │  ← the only global state
│                                  toast, sign-in/out) │
├──────────────────────────────────────────────────────┤
│  API          src/api/api.js     every backend call  │  ← single HTTP client
└──────────────────────────────────────────────────────┘
        │  fetch('/api/...') — Vite proxies to http://localhost:3000
        ▼
   NestJS backend (PostgreSQL)
```

**Rule of thumb:** a *page* owns its own data (local `useState`); only
identity/notifications are global. This keeps pages independent and easy to explain.

## 3. Data flow in one render cycle

1. User opens `#/client/cases` → `App.jsx` matches the route → renders
   `<Layout roles={['client']}>` around `<ClientCases/>`.
2. `Layout` checks the signed-in user (from `AppContext`); wrong role → redirected
   to their own dashboard.
3. `ClientCases` calls `api.cases.getAll(...)` inside `useEffect` → stores the
   result in `useState` → React re-renders the list.
4. Search / filter / pagination are **pure client-side** re-computations of that
   state (`useMemo`) — no extra API calls.
5. Mutations (create/update/delete) call the API, then either re-fetch or update
   the local list.

## 4. Rendering pattern used by every page

```jsx
const [data, setData]     = useState([]);   // the data
const [loading, setLoad]  = useState(true); // spinner flag
const [error, setError]   = useState('');   // error banner flag

useEffect(() => { load(); }, []);           // fetch on mount

async function load() {
  try { setData(await api.x.y()); }
  catch (e) { setError(e.message); }
  finally { setLoad(false); }
}

if (loading) return <Loading/>;             // 1. spinner
if (error)  return <ErrorBanner .../>;      // 2. error
return <PageWithData/>;                     // 3. the real UI
```

This "loading → error → content" triple is consistent across the whole app.

## 5. Design decisions worth defending in a viva

- **Why one API module instead of fetch calls everywhere?** One place to attach
  the JWT/role/CSRF headers, one place to normalize errors — the vanilla app had
  three competing HTTP helpers (`api.js`, `billing-storage.js`, `cases-storage.js`).
- **Why hash routing?** Deep links work even on `file://` or GitHub Pages; a
  history-API router would need server rewrites.
- **Why keep list data in page state, not context?** Context re-renders every
  consumer on change; page data doesn't need that.
- **Why Tailwind over the old CSS files?** The vanilla app had 27 stylesheet
  files (~170 KB) with heavy duplication; utilities made the styling reviewable
  line-by-line next to the markup it styles.
