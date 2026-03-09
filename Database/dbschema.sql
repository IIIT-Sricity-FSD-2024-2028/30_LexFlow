--  Use this below syntax for auto generated primary key ---> recommender for newer versions

-- to think whether admin table needs to be created..

CREATE TABLE lawfirm_meta (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    admin_email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    address             TEXT NOT NULL,
    avg_rating          NUMERIC(3,2) CHECK (avg_rating BETWEEN 0 AND 5),
    logo_url            TEXT,
    firm_size           INT,
    established_in      INT,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE practice_areas (
    id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    VARCHAR(100) UNIQUE NOT NULL       -- e.g. 'Criminal', 'Civil', 'Corporate'
);





-- Many-to-many: firm <--> practice areas
CREATE TABLE lawfirm_practice_areas (
    lawfirm_id          INT NOT NULL,
    practice_area_id    INT NOT NULL,

    PRIMARY KEY (lawfirm_id, practice_area_id),

    CONSTRAINT fk_lpa_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_lpa_practice_area
        FOREIGN KEY (practice_area_id)
        REFERENCES practice_areas(id)
        ON DELETE CASCADE
);

CREATE TABLE courts (
    id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    VARCHAR(200) UNIQUE NOT NULL,      -- e.g. 'Madras High Court'
    city    VARCHAR(100),
    state   VARCHAR(100)
);

-- Many-to-many: firm <--> courts
CREATE TABLE lawfirm_courts (
    lawfirm_id  INT NOT NULL,
    court_id    INT NOT NULL,

    PRIMARY KEY (lawfirm_id, court_id),

    CONSTRAINT fk_lc_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_lc_court
        FOREIGN KEY (court_id)
        REFERENCES courts(id)
        ON DELETE CASCADE
);

CREATE TABLE lawfirm_contact_details (
    -- is this id below necessary? we can use lawfirm_id as primary key since it is one to one relationship
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lawfirm_id      INT NOT NULL,
    email           TEXT[],
    website_url     TEXT[],
    phone_number    TEXT[],

    CONSTRAINT fk_lcd_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);


CREATE TABLE lawfirm_admin (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lawfirm_id      INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_admin_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);


CREATE TABLE clients (
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

CREATE TABLE lawyers (
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

    CONSTRAINT fk_lawyer_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE

);

CREATE TABLE lawyer_specializations (
    lawyer_id           INT NOT NULL,
    practice_area_id    INT NOT NULL,

    PRIMARY KEY (lawyer_id, practice_area_id),

    CONSTRAINT fk_ls_lawyer
        FOREIGN KEY (lawyer_id)
        REFERENCES lawyers(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ls_practice_area
        FOREIGN KEY (practice_area_id)
        REFERENCES practice_areas(id)
        ON DELETE CASCADE
);



CREATE TABLE interns (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lawfirm_id      INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    contact_number  VARCHAR(15),
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_intern_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);

CREATE TABLE intern_permissions (
    id                      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    intern_id               INT NOT NULL,
    -- ! to think about these permissions
    can_view_documents      BOOLEAN DEFAULT FALSE,
    can_upload_documents    BOOLEAN DEFAULT FALSE,
    can_add_notes           BOOLEAN DEFAULT FALSE,
    can_onboard_clients     BOOLEAN DEFAULT TRUE,
    granted_by_admin_id     INT,                    -- references lawfirm_meta admin
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ip_intern
        FOREIGN KEY (intern_id)
        REFERENCES interns(id)
        ON DELETE CASCADE
);

CREATE TABLE consultations (
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

    CONSTRAINT fk_cons_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cons_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cons_lawyer
        FOREIGN KEY (lawyer_id)
        REFERENCES lawyers(id)
        ON DELETE SET NULL
);



-- Meeting scheduling within a consultation
CREATE TABLE consultation_meetings (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    consultation_id     INT NOT NULL,
    meeting_type        VARCHAR(20) NOT NULL CHECK (meeting_type IN ('Online', 'In-Person')),
    scheduled_at        TIMESTAMP NOT NULL,
    duration_minutes    INT,
    location_or_link    TEXT,
    status              VARCHAR(20) DEFAULT 'Scheduled'
                            CHECK (status IN ('Scheduled','Completed','Cancelled')),

    CONSTRAINT fk_cm_consultation
        FOREIGN KEY (consultation_id)
        REFERENCES consultations(id)
        ON DELETE CASCADE
);

-- Interaction summaries for each meeting
CREATE TABLE interaction_summaries (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    consultation_id     INT NOT NULL,
    meeting_id          INT,
    created_by_lawyer   INT,
    created_by_intern   INT,
    summary_text        TEXT NOT NULL,
    is_approved         BOOLEAN DEFAULT FALSE,   -- intern drafts need lawyer approval
    approved_by         INT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_is_consultation
        FOREIGN KEY (consultation_id)
        REFERENCES consultations(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_is_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES consultation_meetings(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_is_created_by_lawyer
        FOREIGN KEY (created_by_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_is_created_by_intern
        FOREIGN KEY (created_by_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_is_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES lawyers(id)
        ON DELETE SET NULL
);

CREATE TABLE cases (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- is this needed?
    consultation_id     INT,

    lawfirm_id          INT NOT NULL,
    lawyer_id           INT,
    court_id            INT,
    -- 16 digit number as required by court
    cnr                 VARCHAR(16) UNIQUE,
    case_type           VARCHAR(50) NOT NULL,
    brief_description   VARCHAR(1000) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'Open'
                            CHECK (status IN ('Open','In Progress','Closed','Disposed')),
    filed_date          DATE NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_case_consultation
        FOREIGN KEY (consultation_id)
        REFERENCES consultations(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_case_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_case_lawyer
        FOREIGN KEY (lawyer_id)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_case_court
        FOREIGN KEY (court_id)
        REFERENCES courts(id)
        ON DELETE SET NULL
);

-- Many-to-many: case <--> clients
CREATE TABLE case_clients (
    case_id     INT NOT NULL,
    client_id   INT NOT NULL,
    party_role  VARCHAR(30) DEFAULT 'Petitioner'
                    CHECK (party_role IN ('Petitioner','Respondent','Witness','Other')),

    PRIMARY KEY (case_id, client_id),

    CONSTRAINT fk_cc_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cc_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE CASCADE
);

CREATE TABLE case_opposing_party (
    case_id     INT NOT NULL,
    client_id   INT NOT NULL,
    opposing_party_name VARCHAR(150) NOT NULL,

    PRIMARY KEY (case_id, client_id),

    CONSTRAINT fk_cop_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cop_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE CASCADE
);


CREATE TABLE case_interns (
    case_id     INT NOT NULL,
    intern_id   INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (case_id, intern_id),

    CONSTRAINT fk_ci_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ci_intern
        FOREIGN KEY (intern_id)
        REFERENCES interns(id)
        ON DELETE CASCADE
);

CREATE TABLE case_notes (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id         INT NOT NULL,
    author_lawyer   INT,
    author_intern   INT,
    note_text       TEXT NOT NULL,
    is_approved     BOOLEAN DEFAULT TRUE,   -- intern notes may need lawyer approval
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cn_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cn_lawyer
        FOREIGN KEY (author_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_cn_intern
        FOREIGN KEY (author_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL
);

CREATE TABLE case_tasks (
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

    CONSTRAINT fk_ct_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ct_lawyer
        FOREIGN KEY (assigned_to_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_ct_intern
        FOREIGN KEY (assigned_to_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL
);


CREATE TABLE documents (
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
    is_verified         BOOLEAN DEFAULT FALSE,       -- verified by intern/lawyer
    uploaded_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_doc_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_doc_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_doc_lawyer
        FOREIGN KEY (uploaded_by_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_doc_intern
        FOREIGN KEY (uploaded_by_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL
);

CREATE TABLE document_checklist (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id         INT NOT NULL,
    document_name   VARCHAR(255) NOT NULL,
    is_mandatory    BOOLEAN DEFAULT TRUE,
    submitted       BOOLEAN DEFAULT FALSE,
    document_id     INT,                        -- linked once the document is uploaded
    reminder_sent   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_dc_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_dc_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE SET NULL
);

--- Messaging

CREATE TABLE message_threads (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id     INT,
    lawfirm_id  INT NOT NULL,
    subject     VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_mt_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_mt_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);

CREATE TABLE messages (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    thread_id       INT NOT NULL,
    sender_client   INT,
    sender_lawyer   INT,
    sender_intern   INT,
    content         TEXT NOT NULL,                  -- stored encrypted at rest
    sent_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_msg_thread
        FOREIGN KEY (thread_id)
        REFERENCES message_threads(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_msg_client
        FOREIGN KEY (sender_client)
        REFERENCES clients(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_msg_lawyer
        FOREIGN KEY (sender_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_msg_intern
        FOREIGN KEY (sender_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL
);

-- billing structure is the basic unit of a service

CREATE TABLE billing_structures (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lawfirm_id      INT NOT NULL,
    service_name    VARCHAR(150) NOT NULL,           -- e.g. 'Consultation Fee', 'Filing Fee'
    amount          NUMERIC(12,2) NOT NULL,
    billing_type    VARCHAR(20) DEFAULT 'Fixed'
                        CHECK (billing_type IN ('Fixed','Hourly','Milestone')),

    CONSTRAINT fk_bs_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE
);

CREATE TABLE invoices (
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

    CONSTRAINT fk_inv_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_inv_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_inv_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE SET NULL
);

CREATE TABLE invoice_line_items (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id      INT NOT NULL,
    description     VARCHAR(255) NOT NULL,
    quantity        NUMERIC(6,2) DEFAULT 1,
    unit_price      NUMERIC(12,2) NOT NULL,
    line_total      NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    CONSTRAINT fk_ili_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoices(id)
        ON DELETE CASCADE
);

---
--- Scheduling stuff

CREATE TABLE hearings (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id         INT NOT NULL,
    court_id        INT,
    hearing_date    DATE NOT NULL,
    hearing_time    TIME,
    result          TEXT,
    next_date       DATE,
    -- to think about this --> like what is adjourned
    status          VARCHAR(20) DEFAULT 'Scheduled'
                        CHECK (status IN ('Scheduled','Completed','Postponed','Cancelled')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_hearing_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_hearing_court
        FOREIGN KEY (court_id)
        REFERENCES courts(id)
        ON DELETE SET NULL
);

-- General schedule events (meetings, deadlines, reminders)
CREATE TABLE schedule_events (
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

    CONSTRAINT fk_se_case
        FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_se_lawfirm
        FOREIGN KEY (lawfirm_id)
        REFERENCES lawfirm_meta(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_se_lawyer
        FOREIGN KEY (created_by_lawyer)
        REFERENCES lawyers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_se_intern
        FOREIGN KEY (created_by_intern)
        REFERENCES interns(id)
        ON DELETE SET NULL
);


--- Audit log

CREATE TABLE audit_logs (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_type  VARCHAR(20) NOT NULL CHECK (actor_type IN ('Client','Lawyer','Intern','FirmAdmin')),
    actor_id    INT NOT NULL,
    document_id INT NOT NULL,
    action      VARCHAR(50) NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_al_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE
);

CREATE TABLE notifications (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient_client    INT,
    recipient_lawyer    INT,
    recipient_intern    INT,
    type                VARCHAR(50) NOT NULL,    -- e.g. 'Hearing Reminder', 'Document Request', 'Payment Due'
    title               VARCHAR(255) NOT NULL,
    body                TEXT,
    is_read             BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notif_client
        FOREIGN KEY (recipient_client)
        REFERENCES clients(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notif_lawyer
        FOREIGN KEY (recipient_lawyer)
        REFERENCES lawyers(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notif_intern
        FOREIGN KEY (recipient_intern)
        REFERENCES interns(id)
        ON DELETE CASCADE
);
