# 02 — Getting Started & Folder Structure

## Running the app

```bash
# 1. Frontend
cd 30_LexFlow/front-end-react
npm install        # installs react, react-dom, vite, tailwind (dev-only)
npm run dev        # → http://localhost:5173

# 2. Backend (separate terminal)
cd 30_LexFlow/back-end
npm install
npm run start:dev  # → http://localhost:3000  (needs PostgreSQL)
```

The dev server proxies every `/api/*` request to `http://localhost:3000`
(see `vite.config.js`), so the browser never makes a cross-origin call.

## Other commands

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Runs the validator self-checks (`src/lib/validators.check.js`) |

## Folder structure

```
front-end-react/
├── index.html                 # single HTML page; React mounts into #root
├── package.json               # deps + scripts
├── vite.config.js             # react + tailwind plugins, /api proxy
├── public/img/                # static images (logo, illustrations, icons)
└── src/
    ├── main.jsx               # entry: mounts <App/> into #root
    ├── App.jsx                # THE ROUTER — maps URL → page component
    ├── index.css              # Tailwind import + theme tokens + tiny animations
    ├── router.jsx             # useRoute / navigate / Link / matchRoute
    ├── api/
    │   └── api.js             # every backend endpoint, one exported `api` object
    ├── context/
    │   └── AppContext.jsx     # global state: user, loginRole, toasts
    ├── lib/
    │   ├── format.js          # money/date/initials/roleLabel formatters
    │   ├── validators.js      # form validation rules (email, PIN, password…)
    │   └── validators.check.js# self-check: node's assert (npm run check)
    ├── components/
    │   ├── ui.jsx             # the shared UI kit (buttons, tables, modals…)
    │   ├── Layout.jsx         # sidebar wrapper + auth guard + Breadcrumb
    │   ├── Sidebar.jsx        # role-aware left navigation
    │   ├── Calendar.jsx       # month calendar (booking + schedule pages)
    │   └── Icon.jsx           # all SVG icons in one map
    └── pages/
        ├── Landing.jsx                    # public marketing page
        ├── SignIn.jsx                     # login (role-aware portal)
        ├── onboarding/
        │   ├── OnboardingShell.jsx        # shared card + stepper
        │   ├── ClientOnboarding1/2.jsx    # client sign-up (2 steps)
        │   └── FirmOnboarding1/2/3.jsx    # firm sign-up (3 steps)
        ├── client/
        │   ├── ClientDashboard.jsx        # consultations overview
        │   ├── LawFirmSearch.jsx          # directory + booking modal
        │   ├── ClientCases.jsx            # my cases list
        │   ├── ClientCaseDetails.jsx      # single case (client view)
        │   ├── AdvocateProfile.jsx        # lawyer public profile
        │   ├── ClientBilling.jsx          # invoices + summary
        │   ├── PayNow.jsx                 # card checkout
        │   ├── Transactions.jsx           # full payment history
        │   └── ConsultationChat.jsx       # chat room (client AND lawyer)
        ├── firm/
        │   ├── FirmDashboard.jsx          # incoming requests, accept/assign
        │   ├── FirmCases.jsx              # cases + tasks tabs (firm & lawyer)
        │   ├── FirmCaseDetails.jsx        # full case management
        │   ├── FirmTasks.jsx              # task CRUD (firm & lawyer)
        │   ├── FirmBilling.jsx            # invoices + subscription + plans
        │   └── FirmUsers.jsx              # member management (admin only)
        ├── documents/
        │   ├── DocumentsMain.jsx          # case selector hub
        │   ├── CaseDocuments.jsx          # per-case documents + permissions
        │   ├── ActivityLog.jsx            # audit trail + CSV export
        │   └── ScheduleManagement.jsx     # calendar + day timeline
        └── superadmin/                    # platform owner console
            ├── SADashboard.jsx            # earnings overview + chart
            ├── SARevenue.jsx              # revenue breakdown + charges
            ├── SAFirms.jsx                # firm CRUD + tiers
            ├── SALawyers.jsx              # cross-firm roster
            ├── SAUsers.jsx                # all accounts CRUD
            ├── SAConsultations.jsx        # all bookings
            ├── SAInvoices.jsx             # invoices + commission
            ├── SASettings.jsx             # tier pricing + platform rules
            └── Chart.jsx                  # shared stacked bar chart
```

## Conventions used everywhere

- **One page = one file = one default export.**
- **Data fetching** uses the `loading / error / content` triple (see 01-architecture).
- **Modals** are controlled by a single state variable (`null = closed`).
- **Comments** explain the *why*, matching the vanilla behaviour they replace.
- **Tailwind** only — no page-specific CSS files exist.
