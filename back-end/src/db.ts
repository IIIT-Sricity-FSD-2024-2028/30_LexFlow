import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { BASE_SCHEMA } from './schema-base';

// ── .env loading (no dependency; existing env vars always win) ───────────────
function loadDotEnv(): void {
  // One level up from __dirname = back-end/ whether compiled (dist/db.js) or
  // not (src/db.ts); cwd covers `node` invocations from back-end/ itself.
  const candidates = [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(process.cwd(), '.env'),
  ];
  const envPath = candidates.find((p) => fs.existsSync(p));
  if (!envPath) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Put it in back-end/.env (PostgreSQL connection string, e.g. Aiven).',
  );
}

function isLocalHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  } catch {
    return false;
  }
}

/**
 * pg ≥8.11 treats sslmode=require as verify-full, which fails against Aiven's
 * CA chain (SELF_SIGNED_CERT_IN_CHAIN). Strip sslmode from the URL and set TLS
 * explicitly here instead. Set DB_SSL=false to disable TLS entirely.
 */
function cleanDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('ssl');
    return u.toString();
  } catch {
    return url;
  }
}

const USE_SSL = process.env.DB_SSL !== 'false' && !isLocalHost(DATABASE_URL);

export const pool = new Pool({
  connectionString: cleanDatabaseUrl(DATABASE_URL),
  ...(USE_SSL ? { ssl: { rejectUnauthorized: false } } : {}),
});

/** Run one parameterised query. */
export async function q<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(sql, params);
}

/** Run a unit of work in a transaction. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

// ── Passwords: scrypt (node built-in), stored as scrypt$<salt>$<hash> ────────
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, salt, hash] = (stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(plain, salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

// ── Identity prefixes: ids crossing the API are "<prefix>-<int>" so callers ──
// ── (x-user-id, clientId, …) can be resolved to exactly one actor table. ─────
export type ActorKind = 'sa' | 'fa' | 'lw' | 'in' | 'cl';

export function parseActorId(
  id: string,
): { kind: ActorKind; num: number } | null {
  const m = /^(sa|fa|lw|in|cl)-(\d+)$/.exec(String(id || '').trim());
  return m ? { kind: m[1] as ActorKind, num: Number(m[2]) } : null;
}

export const ACTOR_TABLE: Record<ActorKind, string> = {
  sa: 'platform_admin',
  fa: 'lawfirm_admin',
  lw: 'lawyers',
  in: 'interns',
  cl: 'clients',
};

// ── Schema delta on top of Database/dbschema.sql, applied idempotently. ──────
// Existing tables (lawfirm_meta, lawfirm_admin, lawyers, interns, clients,
// consultations, cases, invoices, …) are NOT recreated here — they already
// exist in the Aiven database.
const SCHEMA_DELTA = `
CREATE TABLE IF NOT EXISTS platform_admin (
    id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                TEXT PRIMARY KEY,
    lawfirm_id        INT NOT NULL UNIQUE,
    status            VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','cancelled','past_due')),
    started_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at      TIMESTAMP,
    pending_tier      VARCHAR(50),
    pending_charge_id TEXT,
    CONSTRAINT subscription_belongs_to_firm
        FOREIGN KEY (lawfirm_id) REFERENCES lawfirm_meta(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscription_charges (
    id              TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    lawfirm_id      INT NOT NULL,
    tier            VARCHAR(50) NOT NULL,
    kind            VARCHAR(20) NOT NULL DEFAULT 'monthly'
                        CHECK (kind IN ('monthly','tier_change')),
    target_tier     VARCHAR(50),
    period          VARCHAR(7) NOT NULL,
    period_start    TIMESTAMP NOT NULL,
    period_end      TIMESTAMP NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending','Paid','Overdue')),
    issued_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at         TIMESTAMP,
    CONSTRAINT charge_belongs_to_subscription
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    CONSTRAINT charge_belongs_to_firm
        FOREIGN KEY (lawfirm_id) REFERENCES lawfirm_meta(id) ON DELETE CASCADE,
    CONSTRAINT one_monthly_charge_per_period
        UNIQUE (subscription_id, period, kind)
);

CREATE TABLE IF NOT EXISTS tier_pricing (
    tier          VARCHAR(50) PRIMARY KEY
                      CHECK (tier IN ('Starter','Growth','Enterprise')),
    monthly_price NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_settings (
    id               INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    commission_rate  NUMERIC(5,2) NOT NULL DEFAULT 10,
    support_email    VARCHAR(255) NOT NULL DEFAULT 'support@lexflow.legal',
    currency         VARCHAR(10) NOT NULL DEFAULT 'INR',
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    disable_signup   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS invoice_payments (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id  INT NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,
    method      VARCHAR(50) NOT NULL DEFAULT 'Credit Card',
    paid_on     DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT payment_belongs_to_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS case_name      VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS advocate_name  VARCHAR(100);
ALTER TABLE lawfirm_meta ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS invoices_lawfirm_idx  ON invoices(lawfirm_id);
CREATE INDEX IF NOT EXISTS invoices_client_idx   ON invoices(client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx   ON invoices(status);
CREATE INDEX IF NOT EXISTS charges_firm_idx      ON subscription_charges(lawfirm_id);
CREATE INDEX IF NOT EXISTS charges_status_idx    ON subscription_charges(status);
CREATE INDEX IF NOT EXISTS consultations_firm_idx ON consultations(lawfirm_id);
`;

// ── Demo seed: mirrors the old in-memory seed so local dev works the same. ───
async function seedDemoIfEmpty(): Promise<void> {
  const { rows } = await q<{ n: string }>('SELECT count(*)::text AS n FROM lawfirm_meta');
  if (rows[0].n !== '0') return;

  const now = new Date();
  const firms: Array<[number, string, string, string, string]> = [
    [1, 'Sharma & Associates', 'Growth', 'contact@sharma.law', '21, Connaught Place, New Delhi'],
    [2, 'Khanna & Co', 'Growth', 'info@khanna.law', 'Nariman Point, Mumbai'],
    [3, 'Tech Legal Bangalore', 'Growth', 'blr@techlegal.test', 'MG Road, Bangalore'],
    [4, 'Coastal Legal Chennai', 'Growth', 'chennai@coastal.test', 'Marina Beach Road, Chennai'],
    [5, 'Cyber Law Experts Hyderabad', 'Growth', 'hyd@cyber.test', 'Hitech City, Hyderabad'],
  ];
  for (const [id, name, tier, email, address] of firms) {
    await q(
      `INSERT INTO lawfirm_meta (id, name, tier, address, avg_rating, firm_size) OVERRIDING SYSTEM VALUE
       VALUES ($1, $2, $3, $4, 4.5, 10)`,
      [id, name, tier, address],
    );
    await q(
      `INSERT INTO lawfirm_contact_details (lawfirm_id, email, phone_number)
       VALUES ($1, $2, $3)`,
      [id, [email], ['9876543210']],
    );
  }
  // Keep identity sequences ahead of the explicit ids above.
  await q(
    `SELECT setval(pg_get_serial_sequence('lawfirm_meta','id'), (SELECT max(id) FROM lawfirm_meta))`,
  );

  interface SeedActor {
    kind: ActorKind;
    firm?: number;
    name: string;
    email: string;
    password: string;
  }
  const actors: SeedActor[] = [
    { kind: 'sa', name: 'Super Admin', email: 'superadmin@lexflow.test', password: 'superadminpass' },
    { kind: 'fa', firm: 1, name: 'Rajesh Sharma', email: 'firmadmin@lexflow.test', password: 'firmadminpass' },
    { kind: 'fa', firm: 2, name: 'Ananya Khanna', email: 'ananya@khanna.law', password: 'firmadminpass' },
    { kind: 'fa', firm: 3, name: 'Siddharth Reddy', email: 'siddharth@techlegal.test', password: 'firmadminpass' },
    { kind: 'fa', firm: 4, name: 'Meenakshi Iyer', email: 'meenakshi@coastal.test', password: 'firmadminpass' },
    { kind: 'fa', firm: 5, name: 'Vikram Singh', email: 'vikram@cyber.test', password: 'firmadminpass' },
    { kind: 'lw', firm: 1, name: 'Lawyer Bob', email: 'bob@lawyer.test', password: 'lawyerpass' },
    { kind: 'lw', firm: 1, name: 'Lawyer Amit', email: 'amit@sharma.law', password: 'lawyerpass' },
    { kind: 'lw', firm: 1, name: 'Lawyer Sunita', email: 'sunita@sharma.law', password: 'lawyerpass' },
    { kind: 'lw', firm: 2, name: 'Lawyer Rahul', email: 'rahul@khanna.law', password: 'lawyerpass' },
    { kind: 'lw', firm: 2, name: 'Lawyer Priya', email: 'priya@khanna.law', password: 'lawyerpass' },
    { kind: 'lw', firm: 2, name: 'Lawyer Vikram', email: 'vikram@khanna.law', password: 'lawyerpass' },
    { kind: 'lw', firm: 3, name: 'Lawyer David', email: 'david@techlegal.test', password: 'lawyerpass' },
    { kind: 'lw', firm: 3, name: 'Lawyer Suman', email: 'suman@techlegal.test', password: 'lawyerpass' },
    { kind: 'lw', firm: 3, name: 'Lawyer Karthik', email: 'karthik@techlegal.test', password: 'lawyerpass' },
    { kind: 'lw', firm: 4, name: 'Lawyer Elena', email: 'elena@coastal.test', password: 'lawyerpass' },
    { kind: 'lw', firm: 4, name: 'Lawyer Arjun', email: 'arjun@coastal.test', password: 'lawyerpass' },
    { kind: 'lw', firm: 4, name: 'Lawyer Divya', email: 'divya@coastal.test', password: 'lawyerpass' },
    { kind: 'lw', firm: 5, name: 'Lawyer Sneha', email: 'sneha@cyber.test', password: 'lawyerpass' },
    { kind: 'lw', firm: 5, name: 'Lawyer Rohan', email: 'rohan@cyber.test', password: 'lawyerpass' },
    { kind: 'in', firm: 1, name: 'Intern Charlie', email: 'charlie@intern.test', password: 'internpass' },
    { kind: 'in', firm: 1, name: 'Intern Aman', email: 'aman@sharma.law', password: 'internpass' },
    { kind: 'in', firm: 1, name: 'Intern Riya', email: 'riya@sharma.law', password: 'internpass' },
    { kind: 'in', firm: 2, name: 'Intern Karan', email: 'karan@khanna.law', password: 'internpass' },
    { kind: 'in', firm: 2, name: 'Intern Ishita', email: 'ishita@khanna.law', password: 'internpass' },
    { kind: 'in', firm: 2, name: 'Intern Sameer', email: 'sameer@khanna.law', password: 'internpass' },
    { kind: 'in', firm: 3, name: 'Intern Arjun', email: 'arjun@techlegal.test', password: 'internpass' },
    { kind: 'in', firm: 3, name: 'Intern Kavya', email: 'kavya@techlegal.test', password: 'internpass' },
    { kind: 'in', firm: 3, name: 'Intern Manish', email: 'manish@techlegal.test', password: 'internpass' },
    { kind: 'in', firm: 4, name: 'Intern Pooja', email: 'pooja@coastal.test', password: 'internpass' },
    { kind: 'in', firm: 4, name: 'Intern Surya', email: 'surya@coastal.test', password: 'internpass' },
    { kind: 'in', firm: 4, name: 'Intern Lakshmi', email: 'lakshmi@coastal.test', password: 'internpass' },
    { kind: 'in', firm: 5, name: 'Intern Tushar', email: 'tushar@cyber.test', password: 'internpass' },
    { kind: 'in', firm: 5, name: 'Intern Neha', email: 'neha@cyber.test', password: 'internpass' },
    { kind: 'in', firm: 5, name: 'Intern Sahil', email: 'sahil@cyber.test', password: 'internpass' },
    { kind: 'cl', name: 'Client Alice', email: 'alice@client.test', password: 'clientpass' },
    { kind: 'cl', name: 'Client Naveen', email: 'naveen@cyber.test', password: 'clientpass' },
    { kind: 'cl', name: 'Client Dave', email: 'dave@client.test', password: 'clientpass' },
    { kind: 'cl', name: 'Client Eve', email: 'eve@client.test', password: 'clientpass' },
    { kind: 'cl', name: 'Client Frank', email: 'frank@client.test', password: 'clientpass' },
    { kind: 'cl', name: 'Client Grace', email: 'grace@client.test', password: 'clientpass' },
    { kind: 'cl', name: 'Client Henry', email: 'henry@client.test', password: 'clientpass' },
    { kind: 'cl', name: 'Client Irene', email: 'irene@client.test', password: 'clientpass' },
    { kind: 'cl', name: 'Client Jake', email: 'jake@client.test', password: 'clientpass' },
    { kind: 'cl', name: 'Client Laura', email: 'laura@client.test', password: 'clientpass' },
    { kind: 'cl', name: 'Client Mark', email: 'mark@client.test', password: 'clientpass' },
  ];

  for (const a of actors) {
    const hash = hashPassword(a.password);
    if (a.kind === 'sa') {
      await q(
        `INSERT INTO platform_admin (name, email, password_hash) VALUES ($1,$2,$3)`,
        [a.name, a.email, hash],
      );
    } else if (a.kind === 'fa') {
      await q(
        `INSERT INTO lawfirm_admin (lawfirm_id, name, email, password_hash) VALUES ($1,$2,$3,$4)`,
        [a.firm, a.name, a.email, hash],
      );
    } else if (a.kind === 'cl') {
      await q(
        `INSERT INTO clients (client_type, name, contact_number, email_address, address, password_hash)
         VALUES ('Individual', $1, '', $2, '-', $3)`,
        [a.name, a.email, hash],
      );
    } else {
      const table = a.kind === 'lw' ? 'lawyers' : 'interns';
      await q(
        `INSERT INTO ${table} (lawfirm_id, name, email, contact_number, password_hash) VALUES ($1,$2,$3,'',$4)`,
        [a.firm, a.name, a.email, hash],
      );
    }
  }

  // Clients are platform-global; a client belongs to a firm through a
  // consultation or a case. Seed one consultation per client→firm pairing so
  // the billing client dropdown works out of the box.
  const firmOfEmail = (email: string): number => {
    if (['alice@client.test', 'dave@client.test'].includes(email)) return 1;
    if (['eve@client.test', 'frank@client.test'].includes(email)) return 2;
    if (['grace@client.test', 'henry@client.test'].includes(email)) return 3;
    if (['irene@client.test', 'jake@client.test'].includes(email)) return 4;
    return 5; // laura, mark, naveen
  };
  const clients = await q<{ id: number; email_address: string }>(
    `SELECT id, email_address FROM clients`,
  );
  for (const c of clients.rows) {
    await q(
      `INSERT INTO consultations (client_id, lawfirm_id, status, subject)
       VALUES ($1, $2, 'Pending', 'Initial consultation')`,
      [c.id, firmOfEmail(c.email_address)],
    );
  }

  await q(
    `INSERT INTO tier_pricing (tier, monthly_price) VALUES
       ('Starter', 2999), ('Growth', 9999), ('Enterprise', 24999)
     ON CONFLICT (tier) DO NOTHING`,
  );
  await q(
    `INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  );

  console.log(`[db] Seeded demo firms/users (${now.toISOString()})`);
}

let initPromise: Promise<void> | null = null;

/** Connect, apply the schema delta, seed demo data once per process. */
export function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      // Base schema first (no-op if the database is already provisioned), then
      // the delta tables/columns on top, then demo data.
      await q(BASE_SCHEMA);
      await q(SCHEMA_DELTA);
      await seedDemoIfEmpty();
    })();
  }
  return initPromise;
}
