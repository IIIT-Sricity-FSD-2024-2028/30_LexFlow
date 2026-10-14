# 08 — End-to-End Workflows

The flows a professor is most likely to poke at, traced through the code.

## 1. Signing in

```
Landing "Login" dropdown
  → chooseLoginRole('client'|'firmadmin'|'intern')  [AppContext + localStorage]
  → #/signin
SignIn.submit()
  → api.auth.login(email, password)        POST /users/login
      ← { access_token, user }
  → localStorage.access_token = …          (api.js attaches it to every future call)
  → portal check (client portal vs firm portal)
  → signIn(user)                           role normalised, currentUser saved
  → navigate(dashboardPathFor(role))       client→client dashboard, staff→firm, sa→superadmin
```

The route guard in `Layout` is what actually keeps portals separate afterwards.

## 2. Booking a consultation (client)

```
/client/search
  → filters → GET /law-firms?keyword&location&practiceArea&sortBy
  → "Book Now" → modal (chat/in-person, Calendar, time slots, description)
  → submit → POST /consultations
      { clientId, clientName, firmId, firmName, type, date:"May 12, 2026",
        time:"10:30 AM - 10:30 AM", caseDescription, consultationFee,
        bookedViaWorkflow: true }
  → toast → redirect /client/dashboard
```

## 3. Request → confirmed consultation (firm)

```
/firm/dashboard
  → GET /consultations?firmId=… and GET /users/lawyers?firmId=…
  → pick a lawyer in the request card → Accept
      PATCH /consultations/:id { status:'CONFIRMED', lawyerId, lawyerName }
  → list refreshes; the card moves to "Active Consultations"
```

## 4. Consultation → Case conversion (firm)

```
Active table → "Convert to Case"
  → window.prompt("Enter the Case Name/Type")
  → POST /cases { consultation_id, lawfirm_id, lawyer_id, client_id,
                  cnr: random 6-digit, case_type, brief_description,
                  status:'Active', filed_date }
  → PATCH /consultations/:id { status:'COMPLETED' }
  → the case now appears in /firm/cases and /client/cases
```

## 5. The chat thread (client ↔ lawyer)

```
Both sides open the consultation → sessionStorage.active_cons_id
Messages: localStorage["lf_chat_<consultationId>"] = [{ sender, text, time }, …]
  client:  sender 'client', bubble right; canned lawyer reply after 1.5 s
  lawyer:  sender 'lawyer', bubble right on their screen (left on client's)
Because the key is shared per consultation, a client + lawyer on the SAME
browser see one continuous conversation — great for the demo.
```

## 6. Invoice lifecycle (firm → client → superadmin commission)

```
/firm/billing → Create Invoice → POST /billing/invoices
   { clientId, caseName, amount, status:'Pending', dueDate }
/client/billing → sees the invoice → "Pay Now"
   → /client/billing/pay/:id → validate card → POST /billing/payments/:id
      { paymentMethod: 'Card' }        (Card|UPI|Net Banking|Bank Transfer|Cash)
   → invoice becomes Paid
/superadmin/invoices → "Paid through the platform" + commission = amount × rate%
   (rate comes from GET /platform/settings)
```

## 7. Subscription / tier change (firm ↔ superadmin)

```
/firm/billing → "Switch to Growth" → POST /platform/subscriptions/:firmId/tier-change
   → backend issues a one-time charge; plan shows "Growth pending"
   → "Pay now" on the charge → PATCH /platform/charges/:id { status:'Paid' }
   → tier applied
Superadmin can also change tiers directly: /superadmin/firms → Edit (tier field)
```

## 8. Firm onboarding (3 steps, server session)

```
Step 1  POST /users/firm-onboarding/start          → { sessionId }
        POST /users/firm-onboarding/step1/:id      { fullName, email, phone, street, city, state, pinCode }
Step 2  POST /users/firm-onboarding/step2/:id      { primaryEmail, website, phone }
Step 3  GET  /platform/tiers                       → plan picker
        POST /users/firm-onboarding/step3/:id      { adminName, adminEmail, password, confirmPassword, tier }
          ← { adminUserId, firmId }
        signIn({ id, role:'firmadmin', firmId, … }) → /firm/dashboard
```

Draft data lives in `sessionStorage.firmDraft`; the session id in
`sessionStorage.firmOnboardingSessionId`; both are cleared at the end.

## 9. Documents + audit trail

```
/documents → pick a case → /documents/:caseId
  access check: owner | assigned lawyer | same-firm staff | caseAccess grant
  GET /documents?caseId=… , GET /documents/activity?caseId=…
  upload  → POST /documents   (FormData: name, caseId, type, fileType, access, file)
  update  → PATCH /documents/:id   (name, access, version+1, file)
  delete  → DELETE /documents/:id
  view/download/upload/update/delete → POST /documents/activity  (audit entry)
/activity-log → GET /documents/activity → filters → Export CSV
```

## 10. Authentication on every request (recap)

```
api.js request():
  Authorization: Bearer <localStorage.access_token>
  role: <role>                       ← per-call argument
  x-csrf-token: <cookie value>       ← on mutations (double-submit)
  credentials: 'include'             ← session cookie
```

`Layout` (guard) + the backend's role header = two independent layers enforcing
the same rule.
