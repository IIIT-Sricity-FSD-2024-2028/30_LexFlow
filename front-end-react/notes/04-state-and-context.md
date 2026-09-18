# 04 — State Management with useContext

**File:** `src/context/AppContext.jsx`

## What is state here, and where does it live?

| State | Lives in | Why there |
|---|---|---|
| Signed-in `user` | **AppContext** | Every page + the sidebar + the guard need it |
| `loginRole` (picked on the landing dropdown) | **AppContext** + localStorage | Sign-in page reads it after a redirect |
| Toast messages | **AppContext** | Can be triggered from anywhere, rendered once |
| Everything else (lists, filters, modals) | **page-local `useState`** | Only that page cares; no global re-renders |

## The three React primitives used

1. **`createContext(defaultValue)`** — creates the shared "channel".
2. **`<AppContext.Provider value={...}>`** — wraps the whole app in `App.jsx`;
   everything inside can read `value`.
3. **`useContext(AppContext)`** — exposed as the `useApp()` hook:

```jsx
const { user, toast, signIn, signOut } = useApp();
```

## What the context provides

```js
{
  user,             // signed-in user object, or null
  loginRole,        // 'client' | 'firmadmin' | 'intern' | ''
  chooseLoginRole,  // set + remember the landing-page dropdown choice
  signIn(rawUser),  // normalise role, save to localStorage, set state
  signOut(),        // clear every storage key, go to landing
  toast(msg, type), // 'success' (green) | 'error' (red), auto-dismisses 3.5s
  toasts,           // the current list (rendered by <ToastStack/>)
}
```

## Role normalisation (one subtle but important detail)

The backend stores the role as `firmadmin` / `superadmin`, but the UI historically
uses `firmAdmin` / `superAdmin`. `signIn()` normalises **once** so no page ever
worries about it again:

```js
const map = { firmadmin: 'firmAdmin', superadmin: 'superAdmin' };
const normalized = { ...rawUser, role: map[rawUser?.role] || rawUser?.role };
```

After that, every page compares roles case-insensitively: `(user.role).toLowerCase()`.

## Persistence

The user is also written to `localStorage` (`currentUser`) so a refresh keeps you
logged in. The context reads it on startup:

```js
const [user, setUser] = useState(() => getCurrentUser()); // lazy initialiser
```

A `storage` event listener keeps multiple browser tabs in sync (logout in one tab
logs out the others).

## Why not Redux? (the viva answer)

Redux earns its keep when many distant components mutate the *same large store*
with complex actions/reducers. LexFlow's shared state is two small values
(user + toasts); everything else is page-local. `useContext` ships with React —
zero dependencies, zero boilerplate, and the whole provider is ~120 readable lines.

## Why page-local state for lists?

If consultations lived in context, *every* context consumer would re-render on
each keystroke of an unrelated page's search box. Keeping list state inside the
page that fetched it gives natural isolation and simpler code.
