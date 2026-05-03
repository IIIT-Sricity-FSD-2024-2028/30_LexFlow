# Firm Onboarding System - Visual Architecture & Flow

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Browser)                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │   SignIn.html       │  │  LawFirmOnboard  │  │  Lawfirm   │  │
│  │  (Create User)      │→ │  ingStep1.html   │→ │ onboarding │  │
│  │                     │  │  (Firm Info)     │  │ step2.html │  │
│  └─────────────────────┘  └──────────────────┘  │(Contact)   │  │
│                                                  └─────┬──────┘  │
│                                                        │          │
│                                                  ┌─────▼──────┐  │
│                                                  │lawfirmonb   │  │
│                                                  │oardingstep3 │  │
│                                                  │.html (Admin)│  │
│                                                  └─────┬──────┘  │
│                                                        │          │
│                                                  ┌─────▼──────────────┐
│                                                  │firm-consultation-   │
│                                                  │dashboard.html       │
│                                                  │(Success)            │
│                                                  └─────────────────────┘
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API Calls
                              │ (JSON over REST)
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                         NESTJS BACKEND                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  UsersController                        │    │
│  │                                                          │    │
│  │  POST /users (existing)                                │    │
│  │  POST /firm-onboarding/start/:userId          (NEW)   │    │
│  │  POST /firm-onboarding/step1/:sessionId       (NEW)   │    │
│  │  POST /firm-onboarding/step2/:sessionId       (NEW)   │    │
│  │  POST /firm-onboarding/step3/:sessionId       (NEW)   │    │
│  └────────────────┬────────────────────────────────────────┘    │
│                   │                                              │
│                   ↓                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  UsersService                           │    │
│  │                                                          │    │
│  │  • create() [existing]                                 │    │
│  │  • login() [existing]                                  │    │
│  │  • findAll() / findOne() [existing]                    │    │
│  │  • startFirmOnboarding() [NEW]                         │    │
│  │  • submitOnboardingStep1() [NEW]                       │    │
│  │  • submitOnboardingStep2() [NEW]                       │    │
│  │  • submitOnboardingStep3() [NEW]                       │    │
│  │  • getFirmById() [NEW]                                 │    │
│  │  • getAllFirms() [NEW]                                 │    │
│  │  • getFirmAdmin() [NEW]                                │    │
│  │  • getUserFirm() [NEW]                                 │    │
│  └────────────────┬────────────────────────────────────────┘    │
│                   │                                              │
│                   ↓                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              In-Memory Data Storage                      │    │
│  │                                                          │    │
│  │  users[]           - User accounts                      │    │
│  │  firms[]           - Law firm entities        [NEW]     │    │
│  │  firmAdmins[]      - Firm-User associations  [NEW]     │    │
│  │  onboardingSessions{} - Session state        [NEW]     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Three-Step Onboarding Flow

```
                        START
                          │
                          ↓
            ┌─────────────────────────────┐
            │ FIRMADMIN User Created      │
            │ (role: "firmadmin")         │
            └─────────────────────────────┘
                          │
                          ↓
       ┌──────────────────────────────────────┐
       │ POST /firm-onboarding/start/:userId  │
       │ → Returns: sessionId                 │
       │ → Store in localStorage              │
       └──────────────────────────────────────┘
                          │
                          ↓
       ╔════════════════════════════════════════╗
       ║           STEP 1: Firm Info            ║
       ║      LawFirmOnboardingStep1.html       ║
       ╚════════════════════════════════════════╝
       │                                        │
       │  Fields Collected:                     │
       │  • fullName (contact person)           │
       │  • email                               │
       │  • phone                               │
       │  • street                              │
       │  • city                                │
       │  • state                               │
       │  • pinCode                             │
       │  • logo (optional)                     │
       │                                        │
       └─────────────────────────────────────────
                      │
                      ↓
       ┌──────────────────────────────────────┐
       │ POST /firm-onboarding/step1/:sessionId│
       │ Body: FirmOnboardingStep1Dto          │
       │ Response: { sessionId, step: 1 }      │
       └──────────────────────────────────────┘
                      │
                      ↓
       ╔════════════════════════════════════════╗
       ║       STEP 2: Contact Details         ║
       ║    Lawfirmonboardingstep2.html        ║
       ╚════════════════════════════════════════╝
       │                                        │
       │  Fields Collected:                     │
       │  • primaryEmail                        │
       │  • phone                               │
       │  • website (optional)                  │
       │                                        │
       └─────────────────────────────────────────
                      │
                      ↓
       ┌──────────────────────────────────────┐
       │ POST /firm-onboarding/step2/:sessionId│
       │ Body: FirmOnboardingStep2Dto          │
       │ Response: { sessionId, step: 2 }      │
       └──────────────────────────────────────┘
                      │
                      ↓
       ╔════════════════════════════════════════╗
       ║        STEP 3: Admin Setup            ║
       ║    lawfirmonboardingstep3.html        ║
       ╚════════════════════════════════════════╝
       │                                        │
       │  Fields Collected:                     │
       │  • adminName                           │
       │  • adminEmail                          │
       │  • password                            │
       │  • confirmPassword                     │
       │                                        │
       └─────────────────────────────────────────
                      │
                      ↓
       ┌────────────────────────────────────────┐
       │ POST /firm-onboarding/step3/:sessionId │
       │ Body: FirmOnboardingStep3Dto           │
       │ Response: FirmOnboardingResponseDto    │
       └────────────────────────────────────────┘
                      │
                      ├─→ Validate passwords match
                      ├─→ Check email uniqueness
                      ├─→ Create Firm entity
                      ├─→ Create FirmAdmin User
                      ├─→ Create FirmAdmin association
                      ├─→ Delete onboarding session
                      └─→ Return success response
                      │
                      ↓
            ┌─────────────────────────────┐
            │  FIRM CREATED SUCCESSFULLY  │
            │                             │
            │  Firm Record:               │
            │  • firmId: "firm-1"         │
            │  • name: "Firm Name"        │
            │  • primaryEmail: "..."      │
            │  • (all addresses & info)   │
            │                             │
            │  Admin User:                │
            │  • userId: "user-5"         │
            │  • email: "admin@firm.com"  │
            │  • role: "firmadmin"        │
            │                             │
            │  Association:               │
            │  • firmAdminId: "fa-1"      │
            │  • userId: "user-5"         │
            │  • firmId: "firm-1"         │
            └─────────────────────────────┘
                      │
                      ↓
            ┌─────────────────────────────┐
            │ Redirect to Dashboard       │
            │ firm-consultation-          │
            │ dashboard.html              │
            │ + Show success message      │
            └─────────────────────────────┘
                      │
                      ↓
                     END
```

## Data Structure Evolution

```
BEFORE ONBOARDING:
┌──────────────────┐
│  User (FIRMADMIN)│
│  id: "user-5"    │
│  name: "Amit"    │
│  role: FIRMADMIN │
└──────────────────┘
     (No firm)


AFTER STEP 1 (Session):
┌──────────────────┐
│  User (FIRMADMIN)│
│  id: "user-5"    │
└──────────────────┘
     │
     └─→ OnboardingSession {
           step1: {
             fullName: "Amit",
             email: "amit@ex.com",
             phone: "98765...",
             street: "123 Main",
             city: "Delhi",
             state: "Delhi",
             pinCode: "11000"
           }
         }


AFTER STEP 2 (Session):
┌──────────────────┐
│  User (FIRMADMIN)│
│  id: "user-5"    │
└──────────────────┘
     │
     └─→ OnboardingSession {
           step1: { ... },
           step2: {
             primaryEmail: "contact@firm.com",
             phone: "98765...",
             website: "https://firm.com"
           }
         }


AFTER STEP 3 (Complete):
┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐
│  User (original) │  │  User (ADMIN)   │  │  Firm          │
│  id: "user-5"    │  │  id: "user-6"   │  │  id: "firm-1"  │
│  name: "Amit"    │  │  name: "Rahul"  │  │  name: "Firm"  │
│  role: FIRMADMIN │  │  email: "rahul" │  │  email: "..."  │
│                  │  │  password: hash │  │  phone: "..."  │
│  UNUSED AFTER    │  │  role: FIRMADMIN│  │  street: "..." │
│  ONBOARDING      │  │                 │  │  city: "..."   │
└──────────────────┘  └────────┬────────┘  │  state: "..."  │
                               │           │  pinCode: "..."│
                               │           │  website: "..." │
                               │           │  logo: "..."   │
                          FirmAdmin         └────────────────┘
                          ┌──────────┐
                          │id: "fa-1"│
                          │userId: 6 │────→ Points to Admin User
                          │firmId: 1 │────→ Points to Firm
                          └──────────┘
```

## Request/Response Flow Diagram

```
                    FRONTEND                          BACKEND
                       │                                  │
        User signup (FIRMADMIN)                         │
                       │                                  │
         POST /users   ├─────────────────────────────→ Create User
         Body: {...}   │                                  │
                       │ ← ──────────────────── { id: user-5 }
                       │
                       │
                       ↓ (Redirect to Step 1)
            
        LawFirmOnboarding                              │
        Step1.html loads                               │
                       │
                       │ Store userId in localStorage   │
                       │
        Click "Continue"                               │
                       │
    POST /firm-onboarding/start/user-5                 │
                       ├─────────────────────────────→ Create Session
                       │                                  │
                       │ ← ──────────── { sessionId: "s" }
                       │
                       │ Store sessionId in localStorage │
                       │
                       │ (Auto submit Step 1 form)     │
                       │
    POST /firm-onboarding/step1/session-id            │
    Body: {                                            │
      fullName: "Amit",                               │
      email: "amit@ex.com",                           │
      phone: "98765...",                              │
      street: "123 Main",                             │
      city: "Delhi",                                  │
      state: "Delhi",                                 │
      pinCode: "110001"                               │
    }                  ├─────────────────────────────→ Store in Session
                       │                                  │
                       │ ← ────── { sessionId, step: 1 }
                       │
                       ↓ (Redirect to Step 2)
                       
        Lawfirmonboarding                              │
        step2.html loads                               │
                       │
                       │ (Session retained in backend) │
                       │
        Click "Continue"                               │
                       │
    POST /firm-onboarding/step2/session-id            │
    Body: {                                            │
      primaryEmail: "contact@firm.com",                │
      phone: "98765...",                              │
      website: "https://firm.com"                     │
    }                  ├─────────────────────────────→ Store in Session
                       │                                  │
                       │ ← ────── { sessionId, step: 2 }
                       │
                       ↓ (Redirect to Step 3)
                       
        lawfirmonboarding                              │
        step3.html loads                               │
                       │
                       │ (Session retained in backend) │
                       │
        Click "Create Firm Account"                    │
                       │
    POST /firm-onboarding/step3/session-id            │
    Body: {                                            │
      adminName: "Rahul Verma",                        │
      adminEmail: "rahul@firm.com",                   │
      password: "SecurePass@123",                     │
      confirmPassword: "SecurePass@123"               │
    }                  ├─────────────────────────────→ ✓ Validate
                       │                                  ├─ Check pwd match
                       │                                  ├─ Check email unique
                       │                                  │
                       │                              CREATE Firm:
                       │                              firm-1
                       │                                  │
                       │                              CREATE User:
                       │                              user-6 (admin)
                       │                                  │
                       │                              CREATE FirmAdmin:
                       │                              fa-1 (user-6 → firm-1)
                       │                                  │
                       │                              DELETE session
                       │
                       │ ← ────── FirmOnboardingResponseDto
                       │ {                                │
                       │   firmId: "firm-1",             │
                       │   name: "...",                  │
                       │   adminUserId: "user-6",        │
                       │   message: "Success",           │
                       │   createdAt: "..."              │
                       │ }                                │
                       │
                       ↓ (Redirect to Dashboard)
                       
        firm-consultation-dashboard.html
        + Success message display
        + Save firmId in localStorage
```

## Error Flow Example

```
POST /firm-onboarding/step3/invalid-session-id

BACKEND:
  ├─ Look up session by ID
  └─ NOT FOUND
  
RESPONSE:
{
  "statusCode": 400,
  "message": "Invalid session ID",
  "error": "Bad Request"
}

FRONTEND:
  ├─ Check response.ok === false
  ├─ Parse error.message
  ├─ Display: "Invalid session ID"
  └─ Keep user on current page


---

POST /firm-onboarding/step3/valid-session
Body: {
  password: "Pass123",
  confirmPassword: "DifferentPass"
}

BACKEND:
  ├─ Check password === confirmPassword
  └─ MISMATCH DETECTED
  
RESPONSE:
{
  "statusCode": 400,
  "message": "Passwords do not match",
  "error": "Bad Request"
}

FRONTEND:
  ├─ Parse error
  ├─ Display: "Passwords do not match"
  └─ Highlight password fields


---

POST /firm-onboarding/step3/valid-session
Body: {
  adminEmail: "already@registered.com",
  ...
}

BACKEND:
  ├─ Check email in users array
  └─ EMAIL EXISTS
  
RESPONSE:
{
  "statusCode": 409,
  "message": "Email is already registered",
  "error": "Conflict"
}

FRONTEND:
  ├─ Parse error
  ├─ Display: "Email is already registered"
  └─ Clear email field, focus on it
```

## Database Migration Path (Future)

```
Current (In-Memory):
├─ users: User[] (array)
├─ firms: Firm[] (array)
├─ firmAdmins: FirmAdmin[] (array)
└─ onboardingSessions: Map (temporary)

Migration Step 1 (TypeORM/Prisma):
├─ User entity → users table
├─ Firm entity → firms table
├─ FirmAdmin entity → firm_admins table
└─ Session entity → sessions table

Migration Step 2 (Relationships):
├─ FirmAdmin.userId → FK → User.id
├─ FirmAdmin.firmId → FK → Firm.id
└─ Add indexes on (userId, firmId)

Migration Step 3 (Constraints):
├─ UNIQUE constraint on Firm.email
├─ UNIQUE constraint on User.email
├─ PRIMARY KEY on FirmAdmin (userId, firmId)
└─ Cascade DELETE options

Migration Step 4 (Enhancements):
├─ Add soft deletes
├─ Add audit columns (createdBy, updatedBy)
├─ Add session expiry
└─ Add password hashing
```

This visual documentation makes it clear how the system works and how all components interact.
