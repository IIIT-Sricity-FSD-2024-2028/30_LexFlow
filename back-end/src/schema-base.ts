/**
 * Base schema, generated from Database/dbschema.sql + the
 * consultation_meetings table from Database/dump.sql. Regenerate by hand if
 * the source schema changes; executed idempotently at startup by db.ts so a
 * fresh Aiven database provisions itself.
 */
export const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS lawfirm_meta (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    tier            VARCHAR(50) DEFAULT 'Starter',  -- 'Starter' | 'Growth' | 'Enterprise'
    address         TEXT NOT NULL,
    avg_rating      NUMERIC(3,2) CHECK (avg_rating BETWEEN 0 AND 5),
    logo_url        TEXT,
    firm_size       INT,
    established_in  INT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lawfirm_contact_details (
    lawfirm_id      INT PRIMARY KEY,
    email           TEXT[],
    website_url     TEXT[],
    phone_number    TEXT[],

    CONSTRAINT contact_details_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS practice_areas (
    id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    VARCHAR(100) UNIQUE NOT NULL      -- e.g. 'Criminal', 'Civil', 'Corporate'
);

CREATE TABLE IF NOT EXISTS lawfirm_practice_areas (
    lawfirm_id          INT NOT NULL,
    practice_area_id    INT NOT NULL,

    PRIMARY KEY (lawfirm_id, practice_area_id),

    CONSTRAINT lawfirm_practice_areas_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT lawfirm_practice_areas_refers_to_practice_area
        FOREIGN KEY (practice_area_id)
        REFERENCES practice_areas(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS courts (
    id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    VARCHAR(200) UNIQUE NOT NULL,     -- e.g. 'Madras High Court'
    city    VARCHAR(100),
    state   VARCHAR(100)
);

-- MANY-TO-MANY: firm <--> courts
CREATE TABLE IF NOT EXISTS lawfirm_courts (
    lawfirm_id  INT NOT NULL,
    court_id    INT NOT NULL,

    PRIMARY KEY (lawfirm_id, court_id),

    CONSTRAINT lawfirm_courts_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT lawfirm_courts_refers_to_court
        FOREIGN KEY (court_id)
        REFERENCES courts(id)
        ON DELETE CASCADE
);



-- ONE-TO-MANY: one firm can have multiple admins
CREATE TABLE IF NOT EXISTS lawfirm_admin (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lawfirm_id      INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT admin_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_type     VARCHAR(20) NOT NULL CHECK (client_type IN ('Individual', 'Business')),
    name            VARCHAR(100) NOT NULL,
    contact_number  VARCHAR(15) NOT NULL,
    email_address   VARCHAR(255) UNIQUE,
    address         TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ONE-TO-MANY: one firm has many lawyers
CREATE TABLE IF NOT EXISTS lawyers (
    id                      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lawfirm_id              INT NOT NULL,
    name                    VARCHAR(100) NOT NULL,
    email                   VARCHAR(255) UNIQUE NOT NULL,
    contact_number          VARCHAR(15),
    password_hash           TEXT NOT NULL,
    bar_enrollment_number   VARCHAR(50) UNIQUE,
    years_of_experience     INT,
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT lawyer_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);

-- MANY-TO-MANY: a lawyer can have multiple specializations
CREATE TABLE IF NOT EXISTS lawyer_specializations (
    lawyer_id           INT NOT NULL,
    practice_area_id    INT NOT NULL,

    PRIMARY KEY (lawyer_id, practice_area_id),

    CONSTRAINT lawyer_specialization_belongs_to_lawyer
        FOREIGN KEY (lawyer_id)
        REFERENCES lawyers(id)
        ON DELETE CASCADE,

    CONSTRAINT lawyer_specialization_refers_to_practice_area
        FOREIGN KEY (practice_area_id)
        REFERENCES practice_areas(id)
        ON DELETE CASCADE
);

-- ONE-TO-MANY: one firm has many interns
CREATE TABLE IF NOT EXISTS interns (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lawfirm_id      INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    contact_number  VARCHAR(15),
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT intern_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);

-- ONE-TO-ONE: each intern has exactly one permissions record.
CREATE TABLE IF NOT EXISTS intern_permissions (
    -- this is one to one as primary key is unique and not null --> therefore one to one
    intern_id               INT PRIMARY KEY,
    can_view_documents      BOOLEAN DEFAULT FALSE,
    can_upload_documents    BOOLEAN DEFAULT FALSE,
    can_add_notes           BOOLEAN DEFAULT FALSE,
    can_onboard_clients     BOOLEAN DEFAULT TRUE,
    granted_by_admin_id     INT,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT intern_permissions_belong_to_intern
        FOREIGN KEY (intern_id)
        REFERENCES interns(id)
        ON DELETE CASCADE,

    CONSTRAINT intern_permissions_granted_by_admin
        FOREIGN KEY (granted_by_admin_id)
        REFERENCES lawfirm_admin(id)
        ON DELETE SET NULL
);



-- ONE-TO-MANY: a client can have many consultations with different firms
CREATE TABLE IF NOT EXISTS consultations (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id       INT NOT NULL,
    lawfirm_id      INT NOT NULL,
    lawyer_id       INT,
    status          VARCHAR(30) NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending','Accepted','Rejected','In Progress','Closed')),
    subject         VARCHAR(255),
    description     TEXT,
    requested_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at     TIMESTAMP,
    closed_at       TIMESTAMP,

    CONSTRAINT consultation_requested_by_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE CASCADE,

    CONSTRAINT consultation_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT consultation_assigned_to_lawyer
        FOREIGN KEY (lawyer_id)
        REFERENCES lawyers(id)
        ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS consultation_meetings (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    consultation_id integer NOT NULL,
    meeting_type character varying(20) NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    duration_minutes integer,
    location_or_link text,
    status character varying(20) DEFAULT 'Scheduled'::character varying,
    CONSTRAINT consultation_meetings_meeting_type_check CHECK (((meeting_type)::text = ANY ((ARRAY['Online'::character varying, 'In-Person'::character varying])::text[]))),
    CONSTRAINT consultation_meetings_status_check CHECK (((status)::text = ANY ((ARRAY['Scheduled'::character varying, 'Completed'::character varying, 'Cancelled'::character varying])::text[])))
);

-- ONE-TO-ONE with meeting: each meeting has at most one summary.
CREATE TABLE IF NOT EXISTS interaction_summaries (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    consultation_id     INT NOT NULL,
    meeting_id          INT UNIQUE,
    created_by_lawyer   INT,
    created_by_intern   INT,
    summary_text        TEXT NOT NULL,
    is_approved         BOOLEAN DEFAULT FALSE,
    approved_by         INT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT summary_belongs_to_consultation
        FOREIGN KEY (consultation_id)
        REFERENCES consultations(id)
        ON DELETE CASCADE,

    CONSTRAINT summary_linked_to_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES consultation_meetings(id)
        ON DELETE SET NULL,

    CONSTRAINT summary_written_by_lawyer
        FOREIGN KEY (created_by_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT summary_written_by_intern
        FOREIGN KEY (created_by_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL,

    CONSTRAINT summary_approved_by_lawyer
        FOREIGN KEY (approved_by)
        REFERENCES lawyers(id)
        ON DELETE SET NULL
);



-- ONE-TO-ONE with consultation: one consultation leads to at most one case.
-- UNIQUE(consultation_id) enforces this.
CREATE TABLE IF NOT EXISTS cases (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    consultation_id     INT UNIQUE,
    lawfirm_id          INT NOT NULL,
    lawyer_id           INT,
    court_id            INT,
    cnr                 VARCHAR(16) UNIQUE,
    case_type           VARCHAR(50) NOT NULL,
    brief_description   VARCHAR(1000) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'Open'
                            CHECK (status IN ('Open','In Progress','Closed','Disposed')),
    filed_date          DATE NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT case_originated_from_consultation
        FOREIGN KEY (consultation_id)
        REFERENCES consultations(id)
        ON DELETE SET NULL,

    CONSTRAINT case_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT case_handled_by_lawyer
        FOREIGN KEY (lawyer_id)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT case_filed_in_court
        FOREIGN KEY (court_id)
        REFERENCES courts(id)
        ON DELETE SET NULL
);

-- MANY-TO-MANY: a case involves multiple clients; a client can have multiple cases
CREATE TABLE IF NOT EXISTS case_clients (
    case_id     INT NOT NULL,
    client_id   INT NOT NULL,
    party_role  VARCHAR(30) DEFAULT 'Petitioner'
                    CHECK (party_role IN ('Petitioner','Respondent','Witness','Other')),

    PRIMARY KEY (case_id, client_id),

    CONSTRAINT case_client_linked_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT case_client_linked_to_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS case_opposing_party (
    case_id     INT NOT NULL,
    client_id   INT NOT NULL,
    opposing_party_name VARCHAR(150) NOT NULL,

    PRIMARY KEY (case_id, client_id),

    CONSTRAINT opposing_party_linked_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT opposing_party_linked_to_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE CASCADE
);

-- MANY-TO-MANY: multiple interns can assist on a case
CREATE TABLE IF NOT EXISTS case_interns (
    case_id     INT NOT NULL,
    intern_id   INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (case_id, intern_id),

    CONSTRAINT case_intern_linked_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT case_intern_linked_to_intern
        FOREIGN KEY (intern_id)
        REFERENCES interns(id)
        ON DELETE CASCADE
);

-- ONE-TO-MANY: a case accumulates many notes over its lifetime
CREATE TABLE IF NOT EXISTS case_notes (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id         INT NOT NULL,
    author_lawyer   INT,
    author_intern   INT,
    note_text       TEXT NOT NULL,
    is_approved     BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT note_belongs_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT note_authored_by_lawyer
        FOREIGN KEY (author_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT note_authored_by_intern
        FOREIGN KEY (author_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL
);

-- ONE-TO-MANY: a case can have many tasks and deadlines
CREATE TABLE IF NOT EXISTS case_tasks (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id             INT NOT NULL,
    assigned_to_lawyer  INT,
    assigned_to_intern  INT,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    due_date            DATE,
    status              VARCHAR(20) DEFAULT 'Pending'
                            CHECK (status IN ('Pending','In Progress','Completed','Overdue')),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT task_belongs_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT task_assigned_to_lawyer
        FOREIGN KEY (assigned_to_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT task_assigned_to_intern
        FOREIGN KEY (assigned_to_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL
);



CREATE TABLE IF NOT EXISTS documents (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id             INT,
    client_id           INT,
    uploaded_by_lawyer  INT,
    uploaded_by_intern  INT,
    doc_type            VARCHAR(30) NOT NULL
                            CHECK (doc_type IN ('ID Proof','Case Document','Draft','Court Order','Invoice','Other')),
    filename            VARCHAR(255) NOT NULL,
    file_url            TEXT NOT NULL,
    file_size_kb        INT,
    mime_type           VARCHAR(100),
    version             INT DEFAULT 1,
    is_encrypted        BOOLEAN DEFAULT TRUE,
    is_mandatory        BOOLEAN DEFAULT FALSE,
    is_verified         BOOLEAN DEFAULT FALSE,
    uploaded_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT document_belongs_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT document_belongs_to_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE SET NULL,

    CONSTRAINT document_uploaded_by_lawyer
        FOREIGN KEY (uploaded_by_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT document_uploaded_by_intern
        FOREIGN KEY (uploaded_by_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL
);

-- ONE-TO-ONE with document: each checklist item links to at most one uploaded document.
-- UNIQUE(document_id) prevents the same document from satisfying two checklist items.
CREATE TABLE IF NOT EXISTS document_checklist (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id         INT NOT NULL,
    document_name   VARCHAR(255) NOT NULL,
    is_mandatory    BOOLEAN DEFAULT TRUE,
    submitted       BOOLEAN DEFAULT FALSE,
    document_id     INT UNIQUE,
    reminder_sent   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT checklist_belongs_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT checklist_linked_to_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE SET NULL
);



CREATE TABLE IF NOT EXISTS message_threads (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id     INT,
    lawfirm_id  INT NOT NULL,
    subject     VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT thread_linked_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT thread_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    thread_id       INT NOT NULL,
    sender_client   INT,
    sender_lawyer   INT,
    sender_intern   INT,
    content         TEXT NOT NULL,
    sent_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT message_belongs_to_thread
        FOREIGN KEY (thread_id)
        REFERENCES message_threads(id)
        ON DELETE CASCADE,

    CONSTRAINT message_sent_by_client
        FOREIGN KEY (sender_client)
        REFERENCES clients(id)
        ON DELETE SET NULL,

    CONSTRAINT message_sent_by_lawyer
        FOREIGN KEY (sender_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT message_sent_by_intern
        FOREIGN KEY (sender_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL
);



CREATE TABLE IF NOT EXISTS billing_structures (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lawfirm_id      INT NOT NULL,
    service_name    VARCHAR(150) NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    billing_type    VARCHAR(20) DEFAULT 'Fixed'
                        CHECK (billing_type IN ('Fixed','Hourly','Milestone')),

    CONSTRAINT billing_structure_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lawfirm_id      INT NOT NULL,
    client_id       INT NOT NULL,
    case_id         INT,
    invoice_number  VARCHAR(50) UNIQUE NOT NULL,
    total_amount    NUMERIC(12,2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'Unpaid'
                        CHECK (status IN ('Unpaid','Paid','Cancelled')),
    due_date        DATE,
    issued_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT,
    transaction_ref VARCHAR(100) UNIQUE,

    CONSTRAINT invoice_issued_by_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT invoice_billed_to_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE CASCADE,

    CONSTRAINT invoice_linked_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id      INT NOT NULL,
    description     VARCHAR(255) NOT NULL,
    quantity        NUMERIC(6,2) DEFAULT 1,
    unit_price      NUMERIC(12,2) NOT NULL,
    line_total      NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    CONSTRAINT line_item_belongs_to_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoices(id)
        ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS hearings (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id         INT NOT NULL,
    court_id        INT,
    hearing_date    DATE NOT NULL,
    hearing_time    TIME,
    result          TEXT,
    next_date       DATE,
    status          VARCHAR(20) DEFAULT 'Scheduled'
                        CHECK (status IN ('Scheduled','Completed','Postponed','Cancelled')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT hearing_belongs_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT hearing_held_in_court
        FOREIGN KEY (court_id)
        REFERENCES courts(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS schedule_events (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id             INT,
    lawfirm_id          INT NOT NULL,
    created_by_lawyer   INT,
    created_by_intern   INT,
    event_type          VARCHAR(30) NOT NULL
                            CHECK (event_type IN ('Hearing','Meeting','Deadline','Reminder','Other')),
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    event_date          DATE NOT NULL,
    event_time          TIME,
    is_recurring        BOOLEAN DEFAULT FALSE,
    reminder_sent       BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT event_linked_to_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT event_belongs_to_firm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT event_created_by_lawyer
        FOREIGN KEY (created_by_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT event_created_by_intern
        FOREIGN KEY (created_by_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL
);



CREATE TABLE IF NOT EXISTS audit_logs (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_type  VARCHAR(20) NOT NULL CHECK (actor_type IN ('Client','Lawyer','Intern','FirmAdmin')),
    actor_id    INT NOT NULL,
    document_id INT NOT NULL,
    action      VARCHAR(50) NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT audit_log_refers_to_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS notifications (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient_client    INT,
    recipient_lawyer    INT,
    recipient_intern    INT,
    type                VARCHAR(50) NOT NULL,
    title               VARCHAR(255) NOT NULL,
    body                TEXT,
    is_read             BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT notification_sent_to_client
        FOREIGN KEY (recipient_client)
        REFERENCES clients(id)
        ON DELETE CASCADE,

    CONSTRAINT notification_sent_to_lawyer
        FOREIGN KEY (recipient_lawyer)
        REFERENCES lawyers(id)
        ON DELETE CASCADE,

    CONSTRAINT notification_sent_to_intern
        FOREIGN KEY (recipient_intern)
        REFERENCES interns(id)
        ON DELETE CASCADE
);`;
