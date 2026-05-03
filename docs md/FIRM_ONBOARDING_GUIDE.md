# Firm and FirmAdmin Implementation

## Overview
This document describes the implementation of Firm and FirmAdmin entities to support the law firm onboarding workflow for FIRMADMIN users.

## Entities

### 1. Firm Entity (`firm.entity.ts`)
Represents a law firm in the system.

**Fields:**
- `id`: Unique identifier (e.g., "firm-1")
- `name`: Firm name (from onboarding step 1)
- `email`: Primary contact email (from step 1)
- `phone`: Phone number (from step 1)
- `street`: Street address (from step 1)
- `city`: City name (from step 1)
- `state`: State name (from step 1)
- `pinCode`: PIN/Zip code (from step 1)
- `logo`: Firm logo (optional, from step 1)
- `primaryEmail`: Primary operational email (from step 2)
- `website`: Firm website URL (optional, from step 2)
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

### 2. FirmAdmin Entity (`firm-admin.entity.ts`)
Associates a User with a Firm, creating the relationship between a FIRMADMIN user and their firm.

**Fields:**
- `id`: Unique identifier (e.g., "firm-admin-1")
- `userId`: Reference to User (the admin)
- `firmId`: Reference to Firm (the firm they manage)
- `role`: User role (always `UserRole.FIRMADMIN`)
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

## DTOs (Data Transfer Objects)

### FirmOnboardingStep1Dto
Collects basic firm information.
- fullName: Contact person name
- email: Contact email
- phone: Phone number
- street: Street address
- city: City
- state: State
- pinCode: PIN/Zip code
- logo: Optional firm logo

### FirmOnboardingStep2Dto
Collects firm contact details.
- primaryEmail: Primary operational email
- phone: Phone number
- website: Optional website URL

### FirmOnboardingStep3Dto
Sets up the firm admin account.
- adminName: Admin's full name
- adminEmail: Admin's email
- password: Admin's password (min 8 chars)
- confirmPassword: Password confirmation

### FirmOnboardingResponseDto
Response after completing all onboarding steps.
- firmId: Created firm ID
- name: Firm name
- primaryEmail: Firm's primary email
- adminUserId: Created admin user ID
- adminEmail: Admin's email
- message: Success message
- createdAt: Creation timestamp

## API Endpoints

### 1. Start Onboarding
```
POST /users/firm-onboarding/start/:userId
```
Initiates a firm onboarding session for a FIRMADMIN user.

**Response:**
```json
{
  "sessionId": "session-1234567890"
}
```

### 2. Submit Step 1
```
POST /users/firm-onboarding/step1/:sessionId
Body: FirmOnboardingStep1Dto
```
Submits firm basic information.

### 3. Submit Step 2
```
POST /users/firm-onboarding/step2/:sessionId
Body: FirmOnboardingStep2Dto
```
Submits firm contact details. Requires Step 1 completion.

### 4. Submit Step 3 (Final)
```
POST /users/firm-onboarding/step3/:sessionId
Body: FirmOnboardingStep3Dto
```
Completes onboarding by creating firm and admin account.

**Response:**
```json
{
  "firmId": "firm-1",
  "name": "Sharma & Associates",
  "primaryEmail": "contact@firm.com",
  "adminUserId": "user-5",
  "adminEmail": "rahul.verma@lawfirm.in",
  "message": "Firm and admin account created successfully",
  "createdAt": "2026-04-30T10:30:00Z"
}
```

## Workflow

1. **User Registration**: FIRMADMIN user is created with `role = UserRole.FIRMADMIN`
2. **Start Onboarding**: Frontend redirects to `LawFirmOnboardingStep1.html` and calls `/users/firm-onboarding/start/:userId` to get a session ID
3. **Step 1**: User enters firm basic info → calls `/users/firm-onboarding/step1/:sessionId` → redirects to Step 2
4. **Step 2**: User enters contact info → calls `/users/firm-onboarding/step2/:sessionId` → redirects to Step 3
5. **Step 3**: User sets admin password → calls `/users/firm-onboarding/step3/:sessionId`
6. **Complete**: System creates:
   - Firm entity with all collected information
   - New FIRMADMIN user for the admin account
   - FirmAdmin association linking the two
   - Session is cleaned up
   - User is redirected to dashboard with success message

## Implementation Details

### In-Memory Storage
Currently using in-memory arrays:
- `private firms: Firm[]` - Stores all firms
- `private firmAdmins: FirmAdmin[]` - Stores firm-admin associations
- `private onboardingSessions: Map<string, FirmOnboardingSession>` - Temporary session storage

### Session Management
Onboarding sessions are temporary and are deleted after step 3 completion or timeout.

## Future Enhancements

1. **Database Integration**: Replace in-memory storage with TypeORM/Prisma
2. **Logo Upload**: Implement file upload for firm logos
3. **Validation**: Add custom validators for phone, PIN codes, URLs
4. **Audit Logging**: Track onboarding completions
5. **Email Notifications**: Send confirmation emails to admin
6. **Session Expiry**: Implement session timeout mechanism

## User Flow (Frontend Integration)

```
SignIn.html (FIRMADMIN signup)
    ↓
[Create User API Call]
    ↓
LawFirmOnboardingStep1.html
    ↓
[Call: POST /users/firm-onboarding/start/:userId → sessionId]
[Call: POST /users/firm-onboarding/step1/:sessionId → step 1 complete]
    ↓
Lawfirmonboardingstep2.html
    ↓
[Call: POST /users/firm-onboarding/step2/:sessionId → step 2 complete]
    ↓
lawfirmonboardingstep3.html
    ↓
[Call: POST /users/firm-onboarding/step3/:sessionId → success]
    ↓
firm-consultation-dashboard.html (Success with firm info)
```

## Important Notes

1. **Password Handling**: In production, implement proper password hashing (bcrypt)
2. **Email Validation**: Ensure primary and admin emails are unique across the system
3. **Role-Based Access**: Only FIRMADMIN users can access firm-related endpoints
4. **Error Handling**: Proper error responses for invalid sessions, incomplete steps, duplicate emails
5. **Session Security**: Implement CSRF protection and session validation
