# LexFlow React Frontend — Notes

This `notes/` directory explains the **entire React frontend**: architecture, every
component, state management, routing, the API layer, every page, and the key
end-to-end workflows. It was written so anyone (including our professors) can open
any part of the code and understand it quickly.

## Reading order

| # | File | What it covers |
|---|------|----------------|
| 1 | [01-architecture.md](01-architecture.md) | Big picture: stack, layers, data flow, why this design |
| 2 | [02-getting-started.md](02-getting-started.md) | How to run the app + full folder structure |
| 3 | [03-components.md](03-components.md) | Every shared component explained |
| 4 | [04-state-and-context.md](04-state-and-context.md) | `useContext` state management (user, toasts, auth) |
| 5 | [05-routing.md](05-routing.md) | The hand-rolled hash router + route guards |
| 6 | [06-api-layer.md](06-api-layer.md) | `src/api/api.js`: endpoints, auth headers, CSRF |
| 7 | [07-pages-and-features.md](07-pages-and-features.md) | Every page, grouped by role, with its features |
| 8 | [08-workflows.md](08-workflows.md) | End-to-end flows (login, booking, case conversion, billing…) |
| 9 | [09-vanilla-to-react.md](09-vanilla-to-react.md) | Old file → new file mapping + bugs fixed along the way |

## The 30-second version

- **App**: LexFlow — a legal consultation & law-firm ERP with 4 roles
  (Client, Firm Admin/Lawyer/Intern, Superadmin).
- **Stack**: React 18 + Vite + Tailwind CSS v4. **Only two runtime dependencies**:
  `react` and `react-dom`. No router library, no Redux, no UI kit.
- **State**: one `AppContext` (useContext) holds the signed-in user + toast messages.
  All other data is fetched per page with local `useState`.
- **Routing**: a ~60-line hash router (`src/router.jsx`) — URLs look like
  `#/client/cases/12`.
- **API**: one module (`src/api/api.js`) wraps every backend endpoint; it attaches
  the JWT, the role header and the CSRF header to every request.
- **Styling**: 100% Tailwind utility classes. The only CSS file is `src/index.css`
  (theme tokens + 4 tiny animations).
