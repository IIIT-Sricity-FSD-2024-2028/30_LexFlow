# 09 — Vanilla → React Mapping

Where every old file went, plus what got fixed/improved during the conversion.

## File mapping

| Vanilla (front-end/) | React (front-end-react/src/) |
|---|---|
| index.html + scripts/landing-page.js | `pages/Landing.jsx` |
| pages/sign-in.html + scripts/signin.js | `pages/SignIn.jsx` |
| client-onboarding-step-1/2.html + client-onboarding.js | `pages/onboarding/ClientOnboarding1/2.jsx` |
| lawfirm-onboarding-step-1/2/3.html + lawfirm-onboarding.js | `pages/onboarding/FirmOnboarding1/2/3.jsx` |
| client-consultation-dashboard.* | `pages/client/ClientDashboard.jsx` |
| client-lawfirm-search.* | `pages/client/LawFirmSearch.jsx` |
| client-cases.* | `pages/client/ClientCases.jsx` |
| client-case-details.html (+ expanded) + client-case-details.js | `pages/client/ClientCaseDetails.jsx` |
| client-case-advocate-profile.* | `pages/client/AdvocateProfile.jsx` |
| client-billing.* | `pages/client/ClientBilling.jsx` |
| client-billing-pay-now.* | `pages/client/PayNow.jsx` |
| client-billing-transactions.* | `pages/client/Transactions.jsx` |
| client-join-consultation-interface.* | `pages/client/ConsultationChat.jsx` (client mode) |
| lawyer-join-consultation-interface.* | `pages/client/ConsultationChat.jsx` (`staff` mode) |
| firm-consultation-dashboard.* | `pages/firm/FirmDashboard.jsx` |
| firm-cases.* + lawyer-cases.* | `pages/firm/FirmCases.jsx` (one component, role-aware) |
| firm-case-details.* + lawyer-case-details.* | `pages/firm/FirmCaseDetails.jsx` |
| firm-tasks.* + lawyer-tasks.* | `pages/firm/FirmTasks.jsx` |
| firm-billing.* (+ the broken lawyer-billing.js reuse) | `pages/firm/FirmBilling.jsx` |
| firm-user-management.* | `pages/firm/FirmUsers.jsx` |
| documents-main.* | `pages/documents/DocumentsMain.jsx` |
| case-documents.* (57 KB script) | `pages/documents/CaseDocuments.jsx` |
| activity-log.html (inline script) | `pages/documents/ActivityLog.jsx` |
| schedule-management.html (inline script) | `pages/documents/ScheduleManagement.jsx` |
| superadmin*.html + superadmin.js + superadmin-core.js | `pages/superadmin/*.jsx` + `Chart.jsx` |
| scripts/api.js + billing-storage.js + cases-storage.js | `api/api.js` |
| scripts/auth.js + requireAuth calls | `context/AppContext.jsx` (signIn/signOut) + `components/Layout.jsx` (guard) |
| pages/sidebar.html + scripts/sidebar.js | `components/Sidebar.jsx` + `Layout.jsx` |
| assets/icons.js (data-icon replacement) | `components/Icon.jsx` |
| 27 CSS files (~170 KB) | Tailwind classes + `src/index.css` (~90 lines) |
| query strings (?id=, ?cnr=, ?caseId=) | hash-route segments (`/client/cases/:id` accepts id **or** CNR) |

## Bugs fixed during the conversion

The vanilla app had several broken features. All of them work in the React app:

1. **lawyer-billing** reused `firm-billing.js` but was missing the element IDs it
   referenced (`#valTotalBilled`, client `<select>` fields) → TypeError killed the
   whole page; tables stayed as skeletons forever. Now one `FirmBilling` component
   serves both roles.
2. **lawyer-tasks** Edit/Create referenced modal markup that didn't exist in the
   HTML → `openEditTaskModal` threw. The shared `FirmTasks` includes the modal.
3. **activity-log** loaded its inline script *before* `api.js` →
   `LexFlowAPI` was undefined and the whole script died on cold load. Impossible
   now (ES imports).
4. **Schedule "Save Event"** just clicked the Cancel button — nothing was ever
   saved. Now events persist (localStorage).
5. **Case-details Export button** was never wired to `exportCSV()`. Now it
   downloads a real CSV.
6. **lawyer chat** called an undefined `initStorage()` (uncaught ReferenceError)
   and only had memory stubs → now fully implemented against the real data model.
7. **Empty-state `<td>`s without colSpan** squashed table messages into one
   column → fixed everywhere via `Td colSpan`.
8. Two competing HTTP layers / role-string inconsistencies (`firmadmin` vs
   `firmAdmin`) → normalised once in `AppContext.signIn`, one API module.

## What deliberately stayed the same

- Every endpoint, header, payload shape and status-string (`PENDING`,
  `IN PROGRESS`, …) so the React app runs against the **same NestJS backend
  without any backend change**.
- Field fallbacks (`case_type || title`, `fullName || name`, `paymentDate || date`).
- Page sizes (3/4/5/8/15), the 1.5 s canned chat reply, the ₹ en-IN formatting,
  the toast behaviour, and the "superadmin passes every guard" rule.

## Developer conveniences added

- `npm run check` — assert-based self-check for the validators (no framework).
- Retry buttons on error banners, skeleton loaders, consistent empty states.
- `ponytail:` notes in code mark any deliberate simplification.
