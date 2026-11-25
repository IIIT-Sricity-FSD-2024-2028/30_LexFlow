import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateUserDto, LoginUserDto, UserRole, UserResponseDto, CreateFirmDto, UpdateFirmDto } from './dto';
import { FirmAdminOnboardingDto, FirmOnboardingDto } from './dto/firm-onboarding.dto';
import { FirmOnboardingResponseDto } from './dto/firm-onboarding-response.dto';
import { CasesService } from '../cases/cases.service';
import {
  q, tx, hashPassword, verifyPassword, parseActorId, ACTOR_TABLE, ActorKind,
} from '../db';

export type FirmTier = 'Starter' | 'Growth' | 'Enterprise';

/** Hard seat caps per tier. Enterprise is capped at 10,000 (treated as unlimited). */
export const TIER_LIMITS: Record<FirmTier, { lawyers: number; interns: number }> = {
  Starter: { lawyers: 3, interns: 2 },
  Growth: { lawyers: 25, interns: 10000 },
  Enterprise: { lawyers: 10000, interns: 10000 },
};

export interface Firm {
  id: string;
  tier: FirmTier;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  logo?: string;
  primaryEmail?: string;
  website?: string;
  subtitle?: string;
  description?: string;
  rating?: number;
  reviews?: number;
  price?: number;
  availability?: 'Available' | 'Busy';
  experience?: string;
  bio?: string;
  practiceArea?: string;
  practiceAreas?: string[];
  location?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FirmOnboardingSession {
  data?: FirmOnboardingDto;
  createdAt: Date;
}

interface ActorRow {
  id: number;
  name: string;
  email: string;
  kind: ActorKind;
  lawfirm_id: number | null;
  contact_number: string | null;
  is_active: boolean;
  created_at: Date;
  client_type?: string | null; // clients only
  address?: string | null;     // clients only
  bar_enrollment_number?: string | null;
  aadhaar_last4?: string | null;
}

function requireBarNumber(value?: string): string {
  const number = value?.replace(/\s+/g, '').toUpperCase();
  if (!number) throw new BadRequestException('Bar Council enrollment number is required for lawyers.');
  const match = /^([A-Z]{1,4}(?:&[A-Z]+)?)[/-](\d{1,6})[/-](\d{2}|\d{4})$/.exec(number);
  if (!match) throw new BadRequestException('Use the Bar enrollment format STATE/ROLL/YEAR.');
  const [, council, roll, enteredYear] = match;
  let year = Number(enteredYear);
  if (enteredYear.length === 2) year += year <= 30 ? 2000 : 1900;
  if (Number(roll) < 1 || year < 1950 || year > new Date().getFullYear()) {
    throw new BadRequestException('Enter a valid Bar enrollment roll number and year.');
  }
  return `${council}/${Number(roll)}/${year}`;
}

function requireAadhaarLast4(value?: string): string {
  const number = value?.trim();
  if (!number) throw new BadRequestException('Aadhaar number is required for clients.');
  if (!/^(?:\d{12}|\d{4}-\d{4}-\d{4})$/.test(number) || /^(\d)\1{11}$/.test(number.replace(/-/g, ''))) {
    throw new BadRequestException('Enter a valid 12-digit Aadhaar number.');
  }
  return number.slice(-4);
}

function parseFirmId(firmId: string): number {
  const m = /^firm-(\d+)$/.exec(String(firmId || '').trim());
  if (!m) throw new BadRequestException(`Invalid firmId "${firmId}"`);
  return Number(m[1]);
}

const FIRM_SELECT = `
  SELECT f.id, f.tier, f.name, f.address, f.avg_rating, f.logo_url,
         f.review_count, f.hourly_rate,
         f.created_at, f.updated_at,
         cd.email, cd.website_url, cd.phone_number,
         ARRAY(SELECT pa.name FROM lawfirm_practice_areas lpa
               JOIN practice_areas pa ON pa.id = lpa.practice_area_id
               WHERE lpa.lawfirm_id = f.id ORDER BY pa.name) AS practice_areas
  FROM lawfirm_meta f
  LEFT JOIN lawfirm_contact_details cd ON cd.lawfirm_id = f.id`;

function rowToFirm(r: Record<string, unknown>): Firm {
  const emails = (r.email as string[] | null) || [];
  const phones = (r.phone_number as string[] | null) || [];
  const websites = (r.website_url as string[] | null) || [];
  return {
    id: `firm-${r.id}`,
    tier: (r.tier as FirmTier) || 'Starter',
    name: r.name as string,
    email: emails[0] || '',
    phone: phones[0] || '',
    street: (r.address as string) || '',
    // The address is stored as one string; its last part is the city.
    city: ((r.address as string) || '').split(',').pop()!.trim(),
    state: '',
    pinCode: '',
    logo: (r.logo_url as string) || undefined,
    primaryEmail: emails[0],
    website: websites[0],
    rating: r.avg_rating != null ? Number(r.avg_rating) : undefined,
    reviews: r.review_count != null ? Number(r.review_count) : undefined,
    price: r.hourly_rate != null ? Number(r.hourly_rate) : undefined,
    practiceAreas: (r.practice_areas as string[] | null) || [],
    avatar: (r.logo_url as string) || undefined,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function rowToActor(r: Record<string, unknown>): ActorRow {
  return {
    id: Number(r.id),
    name: r.name as string,
    email: r.email as string,
    kind: r.kind as ActorKind,
    lawfirm_id: r.lawfirm_id != null ? Number(r.lawfirm_id) : null,
    contact_number: (r.contact_number as string) || null,
    is_active: r.is_active !== false,
    created_at: r.created_at as Date,
    client_type: (r.client_type as string) || null,
    address: (r.address as string) || null,
    bar_enrollment_number: (r.bar_enrollment_number as string) || null,
    aadhaar_last4: (r.aadhaar_last4 as string) || null,
  };
}

export const ROLE_OF_KIND: Record<ActorKind, UserRole> = {
  sa: UserRole.SUPERADMIN,
  fa: UserRole.FIRMADMIN,
  lw: UserRole.LAWYER,
  in: UserRole.INTERN,
  cl: UserRole.CLIENT,
};

interface FirmAdminAadhaarViewer {
  role: UserRole;
  firmId?: string;
}

function canManageFirmAdminAadhaar(viewer?: FirmAdminAadhaarViewer, firmId?: string): boolean {
  return viewer?.role === UserRole.SUPERADMIN ||
    (viewer?.role === UserRole.FIRMADMIN && !!firmId && viewer.firmId === firmId);
}

function actorToResponse(a: ActorRow, viewer?: FirmAdminAadhaarViewer): UserResponseDto {
  const prefix = a.kind;
  const firmId = a.lawfirm_id ? `firm-${a.lawfirm_id}` : undefined;
  return {
    id: `${prefix}-${a.id}`,
    fullName: a.name,
    email: a.email,
    role: ROLE_OF_KIND[a.kind],
    createdAt: a.created_at,
    phone: a.contact_number || undefined,
    firmId,
    accountStatus: a.is_active ? 'active' : 'inactive',
    availability: 'available',
    accountType: a.client_type || undefined,
    address: a.address && a.address !== '-' ? a.address : undefined,
    barNumber: a.bar_enrollment_number || undefined,
    aadhaarLast4: a.kind !== 'fa' || canManageFirmAdminAadhaar(viewer, firmId)
      ? a.aadhaar_last4 || undefined
      : undefined,
  };
}

/**
 * Every actor table unioned into one shape. A WHERE on `email` filters for
 * login/duplicate checks; a WHERE on prefixed ids is done by the callers.
 */
export const ACTORS_UNION = `
  SELECT id, name, email, password_hash, NULL::int AS lawfirm_id,
         NULL::varchar AS contact_number, TRUE AS is_active, created_at, 'sa'::text AS kind,
         NULL::varchar AS client_type, NULL::text AS address,
         NULL::varchar AS bar_enrollment_number, NULL::varchar AS aadhaar_last4
    FROM platform_admin
  UNION ALL
  SELECT id, name, email, password_hash, lawfirm_id,
         NULL::varchar, is_active, created_at, 'fa'::text, NULL::varchar, NULL::text, NULL::varchar, aadhaar_last4
    FROM lawfirm_admin
  UNION ALL
  SELECT id, name, email, password_hash, lawfirm_id,
         contact_number, is_active, created_at, 'lw'::text, NULL::varchar, NULL::text, bar_enrollment_number, NULL::varchar
    FROM lawyers
  UNION ALL
  SELECT id, name, email, password_hash, lawfirm_id,
         contact_number, is_active, created_at, 'in'::text, NULL::varchar, NULL::text, NULL::varchar, aadhaar_last4
    FROM interns
  UNION ALL
  SELECT id, name, email_address AS email, password_hash, NULL::int,
         contact_number, is_active, created_at, 'cl'::text, client_type, address, NULL::varchar, aadhaar_last4
    FROM clients`;

@Injectable()
export class UsersService {
  private onboardingSessions: Map<string, FirmOnboardingSession> = new Map();

  constructor(private readonly casesService: CasesService) {}

  async findAll(role?: UserRole, viewer?: FirmAdminAadhaarViewer): Promise<UserResponseDto[]> {
    const filter = role ? `WHERE u.kind = '${this.kindOfRole(role)}'` : '';
    const { rows } = await q(`SELECT * FROM (${ACTORS_UNION}) u ${filter} ORDER BY u.id`);
    return rows.map(row => actorToResponse(rowToActor(row), viewer));
  }

  async findUsersByFirm(firmId: string, viewer?: FirmAdminAadhaarViewer): Promise<UserResponseDto[]> {
    const fid = parseFirmId(firmId);
    const { rows } = await q(
      `SELECT * FROM (${ACTORS_UNION}) u
       WHERE u.lawfirm_id = $1
          OR (u.kind = 'cl' AND u.id IN (
                SELECT client_id FROM consultations WHERE lawfirm_id = $1
                UNION
                SELECT cc.client_id FROM case_clients cc
                  JOIN cases cs ON cs.id = cc.case_id WHERE cs.lawfirm_id = $1
                UNION
                SELECT unnest($2::int[])))
       ORDER BY u.id`,
      [fid, this.casesService.getFirmClientIds(`firm-${fid}`)],
    );
    return rows.map(row => actorToResponse(rowToActor(row), viewer));
  }

  async findOne(id: string, viewer?: FirmAdminAadhaarViewer): Promise<UserResponseDto> {
    const parsed = parseActorId(id);
    if (!parsed) throw new NotFoundException('User not found');
    const { rows } = await q(
      `SELECT * FROM (${ACTORS_UNION}) u WHERE kind = $1 AND id = $2`,
      [parsed.kind, parsed.num],
    );
    if (!rows.length) throw new NotFoundException('User not found');
    return actorToResponse(rowToActor(rows[0]), viewer);
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // FIRMADMIN users can only be created through onboarding flow
    if (createUserDto.role === UserRole.FIRMADMIN) {
      throw new BadRequestException('FIRMADMIN users must be created through firm onboarding');
    }

    if (await this.emailTaken(createUserDto.email)) {
      throw new ConflictException('Email is already registered');
    }

    const kind = this.kindOfRole(createUserDto.role);
    const firmNum = createUserDto.firmId ? parseFirmId(createUserDto.firmId) : null;
    const barNumber = kind === 'lw' ? requireBarNumber(createUserDto.barNumber) : null;
    const hasAadhaar = kind === 'cl' || (kind === 'in' && createUserDto.aadhaar !== undefined);
    const aadhaarLast4 = hasAadhaar ? requireAadhaarLast4(createUserDto.aadhaar) : null;

    if (firmNum && (kind === 'lw' || kind === 'in')) {
      await this.assertSeatAvailable(firmNum, kind);
    }

    const hash = hashPassword(createUserDto.password);
    const created = await tx(async (c) => {
      if (kind === 'sa') {
        // Platform admins are global, not firm-scoped, and platform_admin has
        // no is_active column — a superadmin is never "deactivated" this way.
        const res = await c.query(
          `INSERT INTO platform_admin (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id, created_at`,
          [createUserDto.fullName, createUserDto.email, hash],
        );
        return res.rows[0];
      }
      if (kind === 'cl') {
        const res = await c.query(
          `INSERT INTO clients (client_type, name, contact_number, email_address, address, password_hash, is_active, aadhaar_last4)
           VALUES ('Individual', $1, $2, $3, '-', $4, $5, $6) RETURNING id, created_at`,
          [createUserDto.fullName, createUserDto.phone || '', createUserDto.email, hash,
           createUserDto.accountStatus !== 'inactive', aadhaarLast4],
        );
        // A client belongs to a firm via a consultation/case; if the caller
        // attached a firm at creation time, record that link or the client
        // never appears in the firm's billing dropdown / user list.
        if (firmNum) {
          await c.query(
            `INSERT INTO consultations (client_id, lawfirm_id, status, subject)
             SELECT $1, $2, 'Pending', 'Client onboarding'
             WHERE NOT EXISTS (SELECT 1 FROM consultations WHERE client_id = $1 AND lawfirm_id = $2)`,
            [res.rows[0].id, firmNum],
          );
        }
        return res.rows[0];
      }
      const table = kind === 'lw' ? 'lawyers' : 'interns';
      if (!firmNum) throw new BadRequestException(`${table} require a firmId`);
      const staff = [firmNum, createUserDto.fullName, createUserDto.email, createUserDto.phone || '',
        hash, createUserDto.accountStatus !== 'inactive'];
      if (kind === 'lw') {
        const res = await c.query(
          `INSERT INTO lawyers (lawfirm_id, name, email, contact_number, password_hash, is_active, bar_enrollment_number)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (bar_enrollment_number) DO NOTHING RETURNING id, created_at`,
          [...staff, barNumber],
        );
        if (!res.rows.length) throw new ConflictException('This Bar enrollment number is already registered.');
        return res.rows[0];
      }
      const res = await c.query(
        `INSERT INTO interns (lawfirm_id, name, email, contact_number, password_hash, is_active, aadhaar_last4)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at`,
        [...staff, aadhaarLast4],
      );
      return res.rows[0];
    });

    return actorToResponse({
      id: created.id,
      name: createUserDto.fullName,
      email: createUserDto.email,
      kind,
      lawfirm_id: firmNum,
      contact_number: createUserDto.phone || null,
      is_active: createUserDto.accountStatus !== 'inactive',
      created_at: created.created_at,
      bar_enrollment_number: barNumber,
      aadhaar_last4: aadhaarLast4,
    });
  }

  async updateUser(id: string, updateUserDto: Partial<CreateUserDto>, viewer?: FirmAdminAadhaarViewer): Promise<UserResponseDto> {
    const existing = await this.findOne(id); // throws if unknown
    const parsed = parseActorId(id)!;

    if (parsed.kind === 'fa' && updateUserDto.aadhaar !== undefined && !canManageFirmAdminAadhaar(viewer, existing.firmId)) {
      throw new ForbiddenException('Only an admin of this firm or a superadmin can update this Aadhaar reference.');
    }

    if (updateUserDto.email && updateUserDto.email.toLowerCase() !== existing.email.toLowerCase()) {
      if (await this.emailTaken(updateUserDto.email)) {
        throw new ConflictException('Email is already registered');
      }
    }

    const nextFirmNum = updateUserDto.firmId ? parseFirmId(updateUserDto.firmId) : parsed.kind === 'fa' ? existing.firmId ? parseFirmId(existing.firmId) : null : null;
    const becomesActiveMember =
      (updateUserDto.accountStatus ?? existing.accountStatus) === 'active' &&
      (parsed.kind === 'lw' || parsed.kind === 'in') &&
      !!nextFirmNum &&
      (existing.accountStatus !== 'active' ||
        existing.firmId !== (nextFirmNum ? `firm-${nextFirmNum}` : undefined));

    if (becomesActiveMember) {
      await this.assertSeatAvailable(nextFirmNum!, parsed.kind as 'lw' | 'in', parsed.num);
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };

    if (updateUserDto.fullName) add('name', updateUserDto.fullName);
    if (updateUserDto.email) add(parsed.kind === 'cl' ? 'email_address' : 'email', updateUserDto.email);
    if (updateUserDto.password) add('password_hash', hashPassword(updateUserDto.password));
    if (updateUserDto.phone !== undefined && parsed.kind !== 'sa' && parsed.kind !== 'fa') {
      add('contact_number', updateUserDto.phone);
    }
    if (updateUserDto.accountStatus !== undefined && parsed.kind !== 'sa') {
      add('is_active', updateUserDto.accountStatus === 'active');
    }
    if (updateUserDto.firmId !== undefined && (parsed.kind === 'fa' || parsed.kind === 'lw' || parsed.kind === 'in')) {
      add('lawfirm_id', nextFirmNum);
    }
    if (parsed.kind === 'lw' && updateUserDto.barNumber !== undefined) {
      add('bar_enrollment_number', requireBarNumber(updateUserDto.barNumber));
    }
    if ((parsed.kind === 'cl' || parsed.kind === 'in' || parsed.kind === 'fa') && updateUserDto.aadhaar !== undefined) {
      add('aadhaar_last4', requireAadhaarLast4(updateUserDto.aadhaar));
    }

    if (sets.length) {
      try {
        await q(
          `UPDATE ${ACTOR_TABLE[parsed.kind]} SET ${sets.join(', ')} WHERE id = $${params.length + 1}`,
          [...params, parsed.num],
        );
      } catch (error) {
        if (error.code === '23505' && error.constraint === 'lawyers_bar_enrollment_number_key') {
          throw new ConflictException('This Bar enrollment number is already registered.');
        }
        throw error;
      }
    }

    // Attaching a client to a firm creates the firm↔client link (a
    // consultation) so they show up in that firm's billing dropdown.
    if (parsed.kind === 'cl' && updateUserDto.firmId && nextFirmNum) {
      await q(
        `INSERT INTO consultations (client_id, lawfirm_id, status, subject)
         SELECT $1, $2, 'Pending', 'Client linked to firm'
         WHERE NOT EXISTS (SELECT 1 FROM consultations WHERE client_id = $1 AND lawfirm_id = $2)`,
        [parsed.num, nextFirmNum],
      );
    }

    return this.findOne(id, viewer);
  }

  async deleteUser(id: string): Promise<void> {
    const parsed = parseActorId(id);
    if (!parsed) throw new NotFoundException('User not found');
    // Clients keep their history (consultations, cases, invoices) — deactivate
    // instead of deleting. Other actors are removed outright.
    if (parsed.kind === 'cl') {
      await q(`UPDATE clients SET is_active = FALSE WHERE id = $1`, [parsed.num]);
    } else {
      await q(`DELETE FROM ${ACTOR_TABLE[parsed.kind]} WHERE id = $1`, [parsed.num]);
    }
  }

  async login(loginUserDto: LoginUserDto): Promise<UserResponseDto> {
    const { rows } = await q(
      `SELECT * FROM (${ACTORS_UNION}) u WHERE lower(email) = lower($1)`,
      [loginUserDto.email],
    );
    const row = rows[0];
    if (!row || !verifyPassword(loginUserDto.password, row.password_hash as string)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (loginUserDto.role) {
      const role = rowToActor(row).kind;
      const userRole = ROLE_OF_KIND[role];
      const isFirmPortal = loginUserDto.role === UserRole.FIRMADMIN || loginUserDto.role === UserRole.INTERN;
      const userIsFirmMember = [UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.INTERN].includes(userRole);

      if (isFirmPortal) {
        if (!userIsFirmMember) {
          throw new UnauthorizedException('Access denied: You are not a member of this firm');
        }
      } else if (userRole !== loginUserDto.role) {
        throw new UnauthorizedException('Invalid email, password, or role');
      }
    }

    return actorToResponse(rowToActor(row));
  }

  // Firm Onboarding Methods

  startFirmOnboarding(): { sessionId: string } {
    const sessionId = `session-${Date.now()}`;
    this.onboardingSessions.set(sessionId, { createdAt: new Date() });
    return { sessionId };
  }

  async submitOnboardingStep1(sessionId: string, onboardingDto: FirmOnboardingDto): Promise<{ sessionId: string; step: number }> {
    const session = this.onboardingSessions.get(sessionId);
    if (!session) throw new BadRequestException('Invalid session ID');

    if (!onboardingDto.fullName || !onboardingDto.email || !onboardingDto.phone ||
        !onboardingDto.street || !onboardingDto.city || !onboardingDto.state || !onboardingDto.pinCode) {
      throw new BadRequestException('All Step 1 fields are required');
    }

    session.data = { ...session.data, ...onboardingDto };
    this.onboardingSessions.set(sessionId, session);
    return { sessionId, step: 1 };
  }

  async submitOnboardingStep2(sessionId: string, onboardingDto: FirmOnboardingDto): Promise<{ sessionId: string; step: number }> {
    const session = this.onboardingSessions.get(sessionId);
    if (!session) throw new BadRequestException('Invalid session ID');

    if (!session.data?.fullName || !session.data?.email) {
      throw new BadRequestException('Please complete Step 1 first');
    }

    if (!onboardingDto.primaryEmail || !onboardingDto.phone) {
      throw new BadRequestException('Primary email and phone are required for Step 2');
    }

    session.data = { ...session.data, ...onboardingDto };
    this.onboardingSessions.set(sessionId, session);
    return { sessionId, step: 2 };
  }

  async submitOnboardingStep3(sessionId: string, onboardingDto: FirmAdminOnboardingDto): Promise<FirmOnboardingResponseDto> {
    const session = this.onboardingSessions.get(sessionId);
    if (!session) throw new BadRequestException('Invalid session ID');

    if (!session.data?.fullName || !session.data?.email || !session.data?.primaryEmail) {
      throw new BadRequestException('Please complete Steps 1 and 2 first');
    }

    if (!onboardingDto.adminName || !onboardingDto.adminEmail ||
        !onboardingDto.password || !onboardingDto.confirmPassword) {
      throw new BadRequestException('All admin setup fields are required');
    }

    if (onboardingDto.password !== onboardingDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    if (await this.emailTaken(onboardingDto.adminEmail)) {
      throw new ConflictException('Email is already registered');
    }

    const data = session.data;
    const chosenTier = onboardingDto.tier ?? data.tier;
    const tier: FirmTier = chosenTier && TIER_LIMITS[chosenTier] ? chosenTier : 'Starter';
    const aadhaarLast4 = onboardingDto.adminAadhaar === undefined ? null : requireAadhaarLast4(onboardingDto.adminAadhaar);

    const result = await tx(async (c) => {
      const firmRes = await c.query(
        `INSERT INTO lawfirm_meta (name, tier, address) VALUES ($1,$2,$3) RETURNING id, created_at`,
        [data.fullName, tier,
         [data.street, data.city, data.state, data.pinCode].filter(Boolean).join(', ')],
      );
      const firmId = firmRes.rows[0].id as number;
      await c.query(
        `INSERT INTO lawfirm_contact_details (lawfirm_id, email, phone_number) VALUES ($1,$2,$3)`,
        [firmId, [data.email], [data.phone || '']],
      );
      const adminRes = await c.query(
        `INSERT INTO lawfirm_admin (lawfirm_id, name, email, password_hash, aadhaar_last4) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [firmId, onboardingDto.adminName, onboardingDto.adminEmail, hashPassword(onboardingDto.password), aadhaarLast4],
      );
      return { firmId, firmCreatedAt: firmRes.rows[0].created_at as Date, adminId: adminRes.rows[0].id as number };
    });

    this.onboardingSessions.delete(sessionId);

    return {
      firmId: `firm-${result.firmId}`,
      tier,
      name: data.fullName!,
      primaryEmail: data.primaryEmail,
      adminUserId: `fa-${result.adminId}`,
      adminEmail: onboardingDto.adminEmail,
      message: 'Firm and admin account created successfully',
      createdAt: result.firmCreatedAt,
    };
  }

  async getFirmById(firmId: string): Promise<Firm> {
    const { rows } = await q(`${FIRM_SELECT} WHERE f.id = $1`, [parseFirmId(firmId)]);
    if (!rows.length) throw new NotFoundException('Firm not found');
    return rowToFirm(rows[0]);
  }

  async getAllFirms(): Promise<Firm[]> {
    const { rows } = await q(`${FIRM_SELECT} ORDER BY f.id`);
    return rows.map(rowToFirm);
  }

  async updateFirmTier(firmId: string, tier: FirmTier): Promise<Firm> {
    if (!TIER_LIMITS[tier]) {
      throw new BadRequestException('Invalid tier. Allowed values: Starter, Growth, Enterprise');
    }
    const res = await q(
      `UPDATE lawfirm_meta SET tier = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
      [parseFirmId(firmId), tier],
    );
    if (!res.rowCount) throw new NotFoundException('Firm not found');
    return this.getFirmById(firmId);
  }

  async createFirm(dto: CreateFirmDto): Promise<{ firm: Firm; adminUserId?: string }> {
    if (await this.firmEmailTaken(dto.email)) {
      throw new ConflictException(`A firm with the email "${dto.email}" already exists`);
    }

    const tier: FirmTier = dto.tier && TIER_LIMITS[dto.tier] ? dto.tier : 'Starter';
    const createsAdmin = dto.adminName && dto.adminEmail && dto.adminPassword;
    if (dto.adminAadhaar !== undefined && !createsAdmin) {
      throw new BadRequestException('Enter the firm admin name, email and password to record Aadhaar.');
    }
    const aadhaarLast4 = dto.adminAadhaar === undefined ? null : requireAadhaarLast4(dto.adminAadhaar);

    const result = await tx(async (c) => {
      const firmRes = await c.query(
        `INSERT INTO lawfirm_meta (name, tier, address) VALUES ($1,$2,$3) RETURNING id, created_at, updated_at`,
        [dto.name, tier, [dto.street, dto.city, dto.state, dto.pinCode].filter(Boolean).join(', ')],
      );
      const fid = firmRes.rows[0].id as number;
      await c.query(
        `INSERT INTO lawfirm_contact_details (lawfirm_id, email, phone_number, website_url) VALUES ($1,$2,$3,$4)`,
        [fid, [dto.primaryEmail || dto.email], [dto.phone || ''],
         dto.website ? [dto.website] : null],
      );

      let adminUserId: string | undefined;
      if (createsAdmin) {
        const dup = await c.query(
          `SELECT 1 FROM (${ACTORS_UNION}) u WHERE lower(email) = lower($1)`,
          [dto.adminEmail],
        );
        if (dup.rowCount) {
          throw new ConflictException(`The admin email "${dto.adminEmail}" is already registered`);
        }
        const adminRes = await c.query(
          `INSERT INTO lawfirm_admin (lawfirm_id, name, email, password_hash, aadhaar_last4) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [fid, dto.adminName, dto.adminEmail, hashPassword(dto.adminPassword!), aadhaarLast4],
        );
        adminUserId = `fa-${adminRes.rows[0].id}`;
      }
      return { fid, createdAt: firmRes.rows[0].created_at, updatedAt: firmRes.rows[0].updated_at, adminUserId };
    });

    const firm: Firm = {
      id: `firm-${result.fid}`,
      tier,
      name: dto.name,
      email: dto.email,
      phone: dto.phone || '',
      street: [dto.street, dto.city, dto.state, dto.pinCode].filter(Boolean).join(', '),
      city: dto.city || '',
      state: dto.state || '',
      pinCode: dto.pinCode || '',
      primaryEmail: dto.primaryEmail || dto.email,
      website: dto.website,
      subtitle: dto.subtitle,
      description: dto.description,
      practiceArea: dto.practiceArea,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
    return { firm, adminUserId: result.adminUserId };
  }

  async updateFirm(firmId: string, dto: UpdateFirmDto): Promise<Firm> {
    const fid = parseFirmId(firmId);
    const firm = await this.getFirmById(firmId);

    if (dto.tier !== undefined && !TIER_LIMITS[dto.tier]) {
      throw new BadRequestException('Invalid tier. Allowed values: Starter, Growth, Enterprise');
    }

    if (dto.email && dto.email.toLowerCase() !== firm.email.toLowerCase()) {
      if (await this.firmEmailTaken(dto.email)) {
        throw new ConflictException(`Another firm already uses the email "${dto.email}"`);
      }
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };

    if (dto.name !== undefined) add('name', dto.name);
    if (dto.tier !== undefined) add('tier', dto.tier);
    if (dto.street !== undefined || dto.city !== undefined || dto.state !== undefined || dto.pinCode !== undefined) {
      const parts = [dto.street ?? firm.street, dto.city ?? firm.city, dto.state ?? firm.state, dto.pinCode ?? firm.pinCode];
      add('address', parts.filter(Boolean).join(', '));
    }

    if (sets.length) {
      params.push(fid);
      await q(
        `UPDATE lawfirm_meta SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`,
        params,
      );
    }

    // Contact details (email / phone / website) live in lawfirm_contact_details.
    if (dto.email !== undefined || dto.primaryEmail !== undefined || dto.phone !== undefined || dto.website !== undefined) {
      await q(
        `UPDATE lawfirm_contact_details
         SET email        = COALESCE($2, email),
             phone_number = COALESCE($3, phone_number),
             website_url  = COALESCE($4, website_url)
         WHERE lawfirm_id = $1`,
        [fid,
         (dto.email || dto.primaryEmail) ? [dto.primaryEmail || dto.email] : null,
         dto.phone !== undefined ? [dto.phone] : null,
         dto.website !== undefined ? [dto.website] : null],
      );
    }

    return this.getFirmById(firmId);
  }

  async deleteFirm(firmId: string, cascade = false): Promise<{ message: string; deletedUsers: number }> {
    const fid = parseFirmId(firmId);
    const firm = await this.getFirmById(firmId);

    const members = await q(
      `SELECT count(*)::int AS n FROM (${ACTORS_UNION}) u WHERE lawfirm_id = $1`,
      [fid],
    );
    const count = members.rows[0].n as number;

    if (count > 0 && !cascade) {
      throw new BadRequestException(
        `This firm still has ${count} member(s). ` +
          'Reassign or remove them first, or retry with ?cascade=true to delete them along with the firm.',
      );
    }

    await q(`DELETE FROM lawfirm_meta WHERE id = $1`, [fid]); // FKs cascade members
    return {
      message: `Firm "${firm.name}" deleted successfully`,
      deletedUsers: cascade ? count : 0,
    };
  }

  async getAllClients(): Promise<UserResponseDto[]> {
    const { rows } = await q(
      `SELECT * FROM (${ACTORS_UNION}) u WHERE kind = 'cl' ORDER BY id`,
    );
    return rows.map(row => actorToResponse(rowToActor(row)));
  }

  async getUserFirm(userId: string): Promise<Firm | null> {
    const parsed = parseActorId(userId);
    if (!parsed || parsed.kind === 'sa' || parsed.kind === 'cl') return null;
    const { rows } = await q(
      `SELECT f.* FROM lawfirm_meta f
       JOIN ${ACTOR_TABLE[parsed.kind]} a ON a.lawfirm_id = f.id
       WHERE a.id = $1`,
      [parsed.num],
    );
    return rows.length ? rowToFirm(rows[0]) : null;
  }

  async getUsersByFirm(firmId: string, role?: UserRole): Promise<UserResponseDto[]> {
    const fid = parseFirmId(firmId);

    // Clients are platform-global; a firm's clients are the ones with a
    // consultation at the firm or on one of its cases.
    if (role === UserRole.CLIENT) {
      const { rows } = await q(
        `SELECT * FROM (${ACTORS_UNION}) u WHERE kind = 'cl' AND id IN (
           SELECT client_id FROM consultations WHERE lawfirm_id = $1
           UNION
           SELECT cc.client_id FROM case_clients cc
             JOIN cases cs ON cs.id = cc.case_id WHERE cs.lawfirm_id = $1
           UNION
           SELECT unnest($2::int[]))
         ORDER BY id`,
        [fid, this.casesService.getFirmClientIds(`firm-${fid}`)],
      );
      return rows.map(row => actorToResponse(rowToActor(row)));
    }

    const kind = role ? this.kindOfRole(role) : null;
    const kinds = kind ? [kind] : ['fa', 'lw', 'in'];
    const { rows } = await q(
      `SELECT * FROM (${ACTORS_UNION}) u WHERE lawfirm_id = $1 AND kind = ANY($2) ORDER BY id`,
      [fid, kinds],
    );
    return rows.map(row => actorToResponse(rowToActor(row)));
  }

  async getLawyersByFirmId(firmId?: string): Promise<UserResponseDto[]> {
    const { rows } = await q(
      `SELECT * FROM (${ACTORS_UNION}) u WHERE kind IN ('lw','in') AND ($1::int IS NULL OR lawfirm_id = $1) ORDER BY id`,
      [firmId ? parseFirmId(firmId) : null],
    );
    return rows.map(row => actorToResponse(rowToActor(row)));
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private kindOfRole(role: UserRole): ActorKind {
    switch (role) {
      case UserRole.SUPERADMIN: return 'sa';
      case UserRole.FIRMADMIN: return 'fa';
      case UserRole.LAWYER: return 'lw';
      case UserRole.INTERN: return 'in';
      case UserRole.CLIENT: return 'cl';
      default:
        throw new BadRequestException(`Unsupported role "${role}"`);
    }
  }

  private async emailTaken(email: string): Promise<boolean> {
    const { rowCount } = await q(
      `SELECT 1 FROM (${ACTORS_UNION}) u WHERE lower(email) = lower($1)`,
      [email],
    );
    return !!rowCount;
  }

  private async firmEmailTaken(email: string): Promise<boolean> {
    const { rowCount } = await q(
      `SELECT 1 FROM lawfirm_contact_details WHERE $1 = ANY(email)`,
      [email],
    );
    return !!rowCount;
  }

  /**
   * Throws BadRequestException if the firm's tier has no free seat for the
   * given role. Only ACTIVE members count toward the cap.
   */
  private async assertSeatAvailable(firmId: number, kind: 'lw' | 'in', excludeUserId?: number): Promise<void> {
    const firmRes = await q(`SELECT tier FROM lawfirm_meta WHERE id = $1`, [firmId]);
    if (!firmRes.rowCount) {
      throw new BadRequestException('Firm not found for the provided firmId');
    }
    const limits = TIER_LIMITS[firmRes.rows[0].tier as FirmTier];
    const roleLabel = kind === 'lw' ? 'lawyer' : 'intern';
    const limit = kind === 'lw' ? limits.lawyers : limits.interns;
    const { rows } = await q(
      `SELECT count(*)::int AS n FROM ${ACTOR_TABLE[kind]}
       WHERE lawfirm_id = $1 AND is_active AND ($2::int IS NULL OR id <> $2)`,
      [firmId, excludeUserId ?? null],
    );
    if (rows[0].n >= limit) {
      throw new BadRequestException(
        `Seat limit reached for this tier: ${firmRes.rows[0].tier} allows a maximum of ${limit} ${roleLabel}s per firm. Upgrade the firm's tier to add more.`,
      );
    }
  }
}
