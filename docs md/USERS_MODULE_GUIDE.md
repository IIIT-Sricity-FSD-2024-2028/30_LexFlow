# Users Module - Simplified DTO Architecture

## Overview

This module implements a **simplified DTO structure** for the current academic evaluation phase, while keeping **advanced DTOs intact** for future role-specific features.

## Current Architecture

### Simplified DTOs (Active)

#### 1. **CreateUserDto**
Minimal DTO for user creation - used in all POST requests.

```typescript
{
  fullName: string (required)
  email: string (required, valid email)
  role: 'client' | 'lawyer' | 'intern' | 'admin' (required)
}
```

**Location**: `src/users/dto/create-user.dto.ts`

#### 2. **UserResponseDto**
Safe response DTO - never exposes passwords or sensitive fields.

```typescript
{
  id: string
  fullName: string
  email: string
  role: UserRole
  createdAt: Date
}
```

**Location**: `src/users/dto/user-response.dto.ts`

#### 3. **UserRole Enum**
Shared across simplified and advanced DTOs.

```typescript
enum UserRole {
  CLIENT = 'client',
  LAWYER = 'lawyer',
  INTERN = 'intern',
  ADMIN = 'admin',
}
```

### Advanced DTOs (Archived - Not Used)

These are kept for future implementation when you need role-specific features:

- `CreateClientDto` - Role-specific client registration
- `CreateLawyerDto` - Lawyer with specialization, bar council ID, stats
- `CreateInternDto` - Intern with permissions
- `CreateLawfirmAdminDto` - Admin linked to law firm
- `UpdateUserDto` - Partial updates across all roles

**Location**: `src/users/dto/` (prefixed with role names)

To activate advanced DTOs in future: Uncomment imports in `src/users/dto/index.ts`

---

## API Endpoints

### POST /users
**Create a new user**

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "client"
  }'
```

**Response** (201 Created):
```json
{
  "id": "user-1",
  "fullName": "John Doe",
  "email": "john@example.com",
  "role": "client",
  "createdAt": "2026-04-30T10:30:00Z"
}
```

### GET /users
**Get all users**

```bash
curl http://localhost:3000/users
```

**Response** (200 OK):
```json
[
  {
    "id": "user-1",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "client",
    "createdAt": "2026-04-30T10:30:00Z"
  },
  {
    "id": "user-2",
    "fullName": "Sarah Smith",
    "email": "sarah@example.com",
    "role": "lawyer",
    "createdAt": "2026-04-30T10:31:00Z"
  }
]
```

### GET /users?role=lawyer
**Filter users by role**

```bash
curl "http://localhost:3000/users?role=lawyer"
```

**Response** (200 OK):
```json
[
  {
    "id": "user-2",
    "fullName": "Sarah Smith",
    "email": "sarah@example.com",
    "role": "lawyer",
    "createdAt": "2026-04-30T10:31:00Z"
  }
]
```

---

## Usage in UsersModule

### Setup

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export for other modules
})
export class UsersModule {}
```

### Integration with Other Modules

```typescript
// src/consultations/consultations.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ConsultationsService } from './consultations.service';

@Module({
  imports: [UsersModule],
  providers: [ConsultationsService],
})
export class ConsultationsModule {}
```

### Using UsersService in Another Service

```typescript
// src/consultations/consultations.service.ts
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/dto';

@Injectable()
export class ConsultationsService {
  constructor(private usersService: UsersService) {}

  startConsultation(clientId: string, lawyerId: string) {
    const client = this.usersService.findOne(clientId);
    const lawyer = this.usersService.findOne(lawyerId);

    if (client?.role !== UserRole.CLIENT || lawyer?.role !== UserRole.LAWYER) {
      throw new Error('Invalid user roles for consultation');
    }

    // Start consultation logic
  }
}
```

---

## Transitioning to Advanced DTOs (Future)

When your project needs role-specific features (e.g., billing details for lawyers, permissions for interns):

### Step 1: Uncomment Advanced DTOs
```typescript
// src/users/dto/index.ts
export { CreateLawyerDto } from './create-lawyer.dto';
export { UpdateUserDto } from './update-user.dto';
```

### Step 2: Extend UsersService
```typescript
export class UsersService {
  // Keep existing simplified methods for backward compatibility
  
  // Add role-specific methods
  createLawyer(createLawyerDto: CreateLawyerDto): LawfirmUserResponseDto {
    // Store specialized lawyer data
  }

  updateLawyerProfile(id: string, updateDto: UpdateLawyerDto) {
    // Update lawyer-specific fields
  }
}
```

### Step 3: Add Specialized Routes
```typescript
@Controller('users')
export class UsersController {
  // Keep existing general routes
  
  @Post('lawyers')
  createLawyer(@Body() createLawyerDto: CreateLawyerDto) {
    // Use specialized DTO
  }
}
```

---

## In-Memory Storage

Currently uses a simple in-memory array in `UsersService`:

```typescript
private users: User[] = [];
```

### Upgrade Path to Database

When ready to use a real database:

1. **Install TypeORM or Prisma**
   ```bash
   npm install typeorm @nestjs/typeorm
   ```

2. **Create User Entity**
   ```typescript
   @Entity()
   export class UserEntity {
     @PrimaryGeneratedColumn('uuid')
     id: string;
     
     @Column()
     fullName: string;
     // ... other fields
   }
   ```

3. **Replace In-Memory Storage**
   ```typescript
   export class UsersService {
     constructor(
       @InjectRepository(UserEntity)
       private usersRepository: Repository<UserEntity>,
     ) {}

     create(createUserDto: CreateUserDto) {
       return this.usersRepository.save(createUserDto);
     }
   }
   ```

The DTO structure **doesn't change** - only the internal storage implementation.

---

## Best Practices

✅ **Do:**
- Use `CreateUserDto` for all user creation endpoints
- Return `UserResponseDto` from all controllers
- Keep DTOs focused on one responsibility
- Use Swagger decorators for API documentation
- Import only active DTOs in index.ts

❌ **Don't:**
- Mix simplified and advanced DTOs in the same controller
- Store passwords in response DTOs
- Use role-specific DTOs until you need them
- Overcomplicate the controller with business logic (belongs in service)

---

## File Structure

```
src/users/
├── dto/
│   ├── create-user.dto.ts          ✓ Active (simplified)
│   ├── user-response.dto.ts        ✓ Active (simplified)
│   ├── create-client.dto.ts        ✗ Archived (future use)
│   ├── create-lawyer.dto.ts        ✗ Archived (future use)
│   ├── create-intern.dto.ts        ✗ Archived (future use)
│   ├── create-lawfirm-admin.dto.ts ✗ Archived (future use)
│   ├── update-user.dto.ts          ✗ Archived (future use)
│   ├── user.enums.ts               (not exported; enums in create-user.dto.ts)
│   └── index.ts                    (barrel export, only active DTOs)
├── users.service.ts
├── users.controller.ts
└── users.module.ts
```

---

## Validation & Error Handling

All DTOs use `class-validator` decorators:

```typescript
@IsNotEmpty()   // Required field
@IsString()     // Must be string
@IsEmail()      // Valid email format
@IsEnum(UserRole) // Must be one of enum values
```

The validation is automatically enforced by NestJS's `ValidationPipe`:

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe());
```

If invalid data is sent:
```bash
curl -X POST http://localhost:3000/users \
  -d '{ "fullName": "John", "role": "invalid" }'

# Response: 400 Bad Request
# {
#   "error": "Bad Request",
#   "message": [
#     "role must be one of the following values: client, lawyer, intern, admin"
#   ]
# }
```

---

## Summary

| Aspect | Simplified (Current) | Advanced (Future) |
|--------|----------------------|-------------------|
| **Scope** | Academic evaluation | Role-specific features |
| **DTOs** | CreateUserDto, UserResponseDto | CreateLawyerDto, UpdateUserDto, etc. |
| **Complexity** | Minimal, team-friendly | Feature-rich |
| **Storage** | In-memory array | Can easily migrate to DB |
| **Maintenance** | Low overhead | Extensible without breaking changes |

This design ensures your project stays **simple and fast** today while being **fully extensible** for tomorrow.
