--
-- PostgreSQL database dump
--

\restrict vd7ICGjz56ldQ27E98h83iGQ8PIhu2E05PcqXaq3upZgWJq07DWPWMh1CtewdwC

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3 (Debian 18.3-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: admin
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO admin;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: admin
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    actor_type character varying(20) NOT NULL,
    actor_id integer NOT NULL,
    document_id integer NOT NULL,
    action character varying(50) NOT NULL,
    performed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT audit_logs_actor_type_check CHECK (((actor_type)::text = ANY ((ARRAY['Client'::character varying, 'Lawyer'::character varying, 'Intern'::character varying, 'FirmAdmin'::character varying])::text[])))
);


ALTER TABLE public.audit_logs OWNER TO admin;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.audit_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: billing_structures; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.billing_structures (
    id integer NOT NULL,
    lawfirm_id integer NOT NULL,
    service_name character varying(150) NOT NULL,
    amount numeric(12,2) NOT NULL,
    billing_type character varying(20) DEFAULT 'Fixed'::character varying,
    CONSTRAINT billing_structures_billing_type_check CHECK (((billing_type)::text = ANY ((ARRAY['Fixed'::character varying, 'Hourly'::character varying, 'Milestone'::character varying])::text[])))
);


ALTER TABLE public.billing_structures OWNER TO admin;

--
-- Name: billing_structures_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.billing_structures ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.billing_structures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: case_clients; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.case_clients (
    case_id integer NOT NULL,
    client_id integer NOT NULL,
    party_role character varying(30) DEFAULT 'Petitioner'::character varying,
    CONSTRAINT case_clients_party_role_check CHECK (((party_role)::text = ANY ((ARRAY['Petitioner'::character varying, 'Respondent'::character varying, 'Witness'::character varying, 'Other'::character varying])::text[])))
);


ALTER TABLE public.case_clients OWNER TO admin;

--
-- Name: case_interns; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.case_interns (
    case_id integer NOT NULL,
    intern_id integer NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.case_interns OWNER TO admin;

--
-- Name: case_notes; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.case_notes (
    id integer NOT NULL,
    case_id integer NOT NULL,
    author_lawyer integer,
    author_intern integer,
    note_text text NOT NULL,
    is_approved boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.case_notes OWNER TO admin;

--
-- Name: case_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.case_notes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.case_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: case_opposing_party; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.case_opposing_party (
    case_id integer NOT NULL,
    client_id integer NOT NULL,
    opposing_party_name character varying(150) NOT NULL
);


ALTER TABLE public.case_opposing_party OWNER TO admin;

--
-- Name: case_tasks; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.case_tasks (
    id integer NOT NULL,
    case_id integer NOT NULL,
    assigned_to_lawyer integer,
    assigned_to_intern integer,
    title character varying(255) NOT NULL,
    description text,
    due_date date,
    status character varying(20) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT case_tasks_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'In Progress'::character varying, 'Completed'::character varying, 'Overdue'::character varying])::text[])))
);


ALTER TABLE public.case_tasks OWNER TO admin;

--
-- Name: case_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.case_tasks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.case_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.cases (
    id integer NOT NULL,
    consultation_id integer,
    lawfirm_id integer NOT NULL,
    lawyer_id integer,
    court_id integer,
    cnr character varying(16),
    case_type character varying(50) NOT NULL,
    brief_description character varying(1000) NOT NULL,
    status character varying(30) DEFAULT 'Open'::character varying NOT NULL,
    filed_date date NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cases_status_check CHECK (((status)::text = ANY ((ARRAY['Open'::character varying, 'In Progress'::character varying, 'Closed'::character varying, 'Disposed'::character varying])::text[])))
);


ALTER TABLE public.cases OWNER TO admin;

--
-- Name: cases_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.cases ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    client_type character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    contact_number character varying(15) NOT NULL,
    email_address character varying(255),
    address text NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT clients_client_type_check CHECK (((client_type)::text = ANY ((ARRAY['Individual'::character varying, 'Business'::character varying])::text[])))
);


ALTER TABLE public.clients OWNER TO admin;

--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.clients ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.clients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: consultation_meetings; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.consultation_meetings (
    id integer NOT NULL,
    consultation_id integer NOT NULL,
    meeting_type character varying(20) NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    duration_minutes integer,
    location_or_link text,
    status character varying(20) DEFAULT 'Scheduled'::character varying,
    CONSTRAINT consultation_meetings_meeting_type_check CHECK (((meeting_type)::text = ANY ((ARRAY['Online'::character varying, 'In-Person'::character varying])::text[]))),
    CONSTRAINT consultation_meetings_status_check CHECK (((status)::text = ANY ((ARRAY['Scheduled'::character varying, 'Completed'::character varying, 'Cancelled'::character varying])::text[])))
);


ALTER TABLE public.consultation_meetings OWNER TO admin;

--
-- Name: consultation_meetings_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.consultation_meetings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.consultation_meetings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: consultations; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.consultations (
    id integer NOT NULL,
    client_id integer NOT NULL,
    lawfirm_id integer NOT NULL,
    lawyer_id integer,
    status character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    subject character varying(255),
    description text,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    accepted_at timestamp without time zone,
    closed_at timestamp without time zone,
    CONSTRAINT consultations_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Accepted'::character varying, 'Rejected'::character varying, 'In Progress'::character varying, 'Closed'::character varying])::text[])))
);


ALTER TABLE public.consultations OWNER TO admin;

--
-- Name: consultations_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.consultations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.consultations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: courts; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.courts (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    city character varying(100),
    state character varying(100)
);


ALTER TABLE public.courts OWNER TO admin;

--
-- Name: courts_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.courts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.courts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: document_checklist; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.document_checklist (
    id integer NOT NULL,
    case_id integer NOT NULL,
    document_name character varying(255) NOT NULL,
    is_mandatory boolean DEFAULT true,
    submitted boolean DEFAULT false,
    document_id integer,
    reminder_sent boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.document_checklist OWNER TO admin;

--
-- Name: document_checklist_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.document_checklist ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.document_checklist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    case_id integer,
    client_id integer,
    uploaded_by_lawyer integer,
    uploaded_by_intern integer,
    doc_type character varying(30) NOT NULL,
    filename character varying(255) NOT NULL,
    file_url text NOT NULL,
    file_size_kb integer,
    mime_type character varying(100),
    version integer DEFAULT 1,
    is_encrypted boolean DEFAULT true,
    is_mandatory boolean DEFAULT false,
    is_verified boolean DEFAULT false,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT documents_doc_type_check CHECK (((doc_type)::text = ANY ((ARRAY['ID Proof'::character varying, 'Case Document'::character varying, 'Draft'::character varying, 'Court Order'::character varying, 'Invoice'::character varying, 'Other'::character varying])::text[])))
);


ALTER TABLE public.documents OWNER TO admin;

--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.documents ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: hearings; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.hearings (
    id integer NOT NULL,
    case_id integer NOT NULL,
    court_id integer,
    hearing_date date NOT NULL,
    hearing_time time without time zone,
    result text,
    next_date date,
    status character varying(20) DEFAULT 'Scheduled'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT hearings_status_check CHECK (((status)::text = ANY ((ARRAY['Scheduled'::character varying, 'Completed'::character varying, 'Postponed'::character varying, 'Cancelled'::character varying])::text[])))
);


ALTER TABLE public.hearings OWNER TO admin;

--
-- Name: hearings_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.hearings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.hearings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: interaction_summaries; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.interaction_summaries (
    id integer NOT NULL,
    consultation_id integer NOT NULL,
    meeting_id integer,
    created_by_lawyer integer,
    created_by_intern integer,
    summary_text text NOT NULL,
    is_approved boolean DEFAULT false,
    approved_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.interaction_summaries OWNER TO admin;

--
-- Name: interaction_summaries_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.interaction_summaries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.interaction_summaries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: intern_permissions; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.intern_permissions (
    id integer NOT NULL,
    intern_id integer NOT NULL,
    can_view_documents boolean DEFAULT false,
    can_upload_documents boolean DEFAULT false,
    can_add_notes boolean DEFAULT false,
    can_onboard_clients boolean DEFAULT true,
    granted_by_admin_id integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.intern_permissions OWNER TO admin;

--
-- Name: intern_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.intern_permissions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.intern_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: interns; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.interns (
    id integer NOT NULL,
    lawfirm_id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    contact_number character varying(15),
    password_hash text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.interns OWNER TO admin;

--
-- Name: interns_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.interns ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.interns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.invoice_line_items (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    description character varying(255) NOT NULL,
    quantity numeric(6,2) DEFAULT 1,
    unit_price numeric(12,2) NOT NULL,
    line_total numeric(12,2) GENERATED ALWAYS AS ((quantity * unit_price)) STORED
);


ALTER TABLE public.invoice_line_items OWNER TO admin;

--
-- Name: invoice_line_items_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.invoice_line_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoice_line_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    lawfirm_id integer NOT NULL,
    client_id integer NOT NULL,
    case_id integer,
    invoice_number character varying(50) NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'Unpaid'::character varying,
    due_date date,
    issued_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    transaction_ref character varying(100),
    CONSTRAINT invoices_status_check CHECK (((status)::text = ANY ((ARRAY['Unpaid'::character varying, 'Paid'::character varying, 'Cancelled'::character varying])::text[])))
);


ALTER TABLE public.invoices OWNER TO admin;

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.invoices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lawfirm_admin; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.lawfirm_admin (
    id integer NOT NULL,
    lawfirm_id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.lawfirm_admin OWNER TO admin;

--
-- Name: lawfirm_admin_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.lawfirm_admin ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lawfirm_admin_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lawfirm_contact_details; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.lawfirm_contact_details (
    id integer NOT NULL,
    lawfirm_id integer NOT NULL,
    email text[],
    website_url text[],
    phone_number text[]
);


ALTER TABLE public.lawfirm_contact_details OWNER TO admin;

--
-- Name: lawfirm_contact_details_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.lawfirm_contact_details ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lawfirm_contact_details_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lawfirm_courts; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.lawfirm_courts (
    lawfirm_id integer NOT NULL,
    court_id integer NOT NULL
);


ALTER TABLE public.lawfirm_courts OWNER TO admin;

--
-- Name: lawfirm_meta; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.lawfirm_meta (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    admin_email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    address text NOT NULL,
    avg_rating numeric(3,2),
    logo_url text,
    firm_size integer,
    established_in integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lawfirm_meta_avg_rating_check CHECK (((avg_rating >= (0)::numeric) AND (avg_rating <= (5)::numeric)))
);


ALTER TABLE public.lawfirm_meta OWNER TO admin;

--
-- Name: lawfirm_meta_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.lawfirm_meta ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lawfirm_meta_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lawfirm_practice_areas; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.lawfirm_practice_areas (
    lawfirm_id integer NOT NULL,
    practice_area_id integer NOT NULL
);


ALTER TABLE public.lawfirm_practice_areas OWNER TO admin;

--
-- Name: lawyer_specializations; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.lawyer_specializations (
    lawyer_id integer NOT NULL,
    practice_area_id integer NOT NULL
);


ALTER TABLE public.lawyer_specializations OWNER TO admin;

--
-- Name: lawyers; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.lawyers (
    id integer NOT NULL,
    lawfirm_id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    contact_number character varying(15),
    password_hash text NOT NULL,
    bar_enrollment_number character varying(50),
    years_of_experience integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.lawyers OWNER TO admin;

--
-- Name: lawyers_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.lawyers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lawyers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: message_threads; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.message_threads (
    id integer NOT NULL,
    case_id integer,
    lawfirm_id integer NOT NULL,
    subject character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.message_threads OWNER TO admin;

--
-- Name: message_threads_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.message_threads ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.message_threads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    thread_id integer NOT NULL,
    sender_client integer,
    sender_lawyer integer,
    sender_intern integer,
    content text NOT NULL,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.messages OWNER TO admin;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.messages ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    recipient_client integer,
    recipient_lawyer integer,
    recipient_intern integer,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    body text,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO admin;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.notifications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: practice_areas; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.practice_areas (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.practice_areas OWNER TO admin;

--
-- Name: practice_areas_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.practice_areas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.practice_areas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schedule_events; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.schedule_events (
    id integer NOT NULL,
    case_id integer,
    lawfirm_id integer NOT NULL,
    created_by_lawyer integer,
    created_by_intern integer,
    event_type character varying(30) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    event_date date NOT NULL,
    event_time time without time zone,
    is_recurring boolean DEFAULT false,
    reminder_sent boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT schedule_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['Hearing'::character varying, 'Meeting'::character varying, 'Deadline'::character varying, 'Reminder'::character varying, 'Other'::character varying])::text[])))
);


ALTER TABLE public.schedule_events OWNER TO admin;

--
-- Name: schedule_events_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

ALTER TABLE public.schedule_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.schedule_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: billing_structures billing_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.billing_structures
    ADD CONSTRAINT billing_structures_pkey PRIMARY KEY (id);


--
-- Name: case_clients case_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_clients
    ADD CONSTRAINT case_clients_pkey PRIMARY KEY (case_id, client_id);


--
-- Name: case_interns case_interns_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_interns
    ADD CONSTRAINT case_interns_pkey PRIMARY KEY (case_id, intern_id);


--
-- Name: case_notes case_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_notes
    ADD CONSTRAINT case_notes_pkey PRIMARY KEY (id);


--
-- Name: case_opposing_party case_opposing_party_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_opposing_party
    ADD CONSTRAINT case_opposing_party_pkey PRIMARY KEY (case_id, client_id);


--
-- Name: case_tasks case_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_tasks
    ADD CONSTRAINT case_tasks_pkey PRIMARY KEY (id);


--
-- Name: cases cases_cnr_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_cnr_key UNIQUE (cnr);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: clients clients_email_address_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_email_address_key UNIQUE (email_address);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: consultation_meetings consultation_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.consultation_meetings
    ADD CONSTRAINT consultation_meetings_pkey PRIMARY KEY (id);


--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);


--
-- Name: courts courts_name_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_name_key UNIQUE (name);


--
-- Name: courts courts_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_pkey PRIMARY KEY (id);


--
-- Name: document_checklist document_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.document_checklist
    ADD CONSTRAINT document_checklist_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: hearings hearings_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.hearings
    ADD CONSTRAINT hearings_pkey PRIMARY KEY (id);


--
-- Name: interaction_summaries interaction_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.interaction_summaries
    ADD CONSTRAINT interaction_summaries_pkey PRIMARY KEY (id);


--
-- Name: intern_permissions intern_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.intern_permissions
    ADD CONSTRAINT intern_permissions_pkey PRIMARY KEY (id);


--
-- Name: interns interns_email_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.interns
    ADD CONSTRAINT interns_email_key UNIQUE (email);


--
-- Name: interns interns_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.interns
    ADD CONSTRAINT interns_pkey PRIMARY KEY (id);


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_transaction_ref_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_transaction_ref_key UNIQUE (transaction_ref);


--
-- Name: lawfirm_admin lawfirm_admin_email_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_admin
    ADD CONSTRAINT lawfirm_admin_email_key UNIQUE (email);


--
-- Name: lawfirm_admin lawfirm_admin_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_admin
    ADD CONSTRAINT lawfirm_admin_pkey PRIMARY KEY (id);


--
-- Name: lawfirm_contact_details lawfirm_contact_details_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_contact_details
    ADD CONSTRAINT lawfirm_contact_details_pkey PRIMARY KEY (id);


--
-- Name: lawfirm_courts lawfirm_courts_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_courts
    ADD CONSTRAINT lawfirm_courts_pkey PRIMARY KEY (lawfirm_id, court_id);


--
-- Name: lawfirm_meta lawfirm_meta_admin_email_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_meta
    ADD CONSTRAINT lawfirm_meta_admin_email_key UNIQUE (admin_email);


--
-- Name: lawfirm_meta lawfirm_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_meta
    ADD CONSTRAINT lawfirm_meta_pkey PRIMARY KEY (id);


--
-- Name: lawfirm_practice_areas lawfirm_practice_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_practice_areas
    ADD CONSTRAINT lawfirm_practice_areas_pkey PRIMARY KEY (lawfirm_id, practice_area_id);


--
-- Name: lawyer_specializations lawyer_specializations_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawyer_specializations
    ADD CONSTRAINT lawyer_specializations_pkey PRIMARY KEY (lawyer_id, practice_area_id);


--
-- Name: lawyers lawyers_bar_enrollment_number_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawyers
    ADD CONSTRAINT lawyers_bar_enrollment_number_key UNIQUE (bar_enrollment_number);


--
-- Name: lawyers lawyers_email_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawyers
    ADD CONSTRAINT lawyers_email_key UNIQUE (email);


--
-- Name: lawyers lawyers_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawyers
    ADD CONSTRAINT lawyers_pkey PRIMARY KEY (id);


--
-- Name: message_threads message_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: practice_areas practice_areas_name_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.practice_areas
    ADD CONSTRAINT practice_areas_name_key UNIQUE (name);


--
-- Name: practice_areas practice_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.practice_areas
    ADD CONSTRAINT practice_areas_pkey PRIMARY KEY (id);


--
-- Name: schedule_events schedule_events_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.schedule_events
    ADD CONSTRAINT schedule_events_pkey PRIMARY KEY (id);


--
-- Name: lawfirm_admin fk_admin_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_admin
    ADD CONSTRAINT fk_admin_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: audit_logs fk_al_document; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT fk_al_document FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: billing_structures fk_bs_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.billing_structures
    ADD CONSTRAINT fk_bs_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: cases fk_case_consultation; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT fk_case_consultation FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE SET NULL;


--
-- Name: cases fk_case_court; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT fk_case_court FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE SET NULL;


--
-- Name: cases fk_case_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT fk_case_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: cases fk_case_lawyer; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT fk_case_lawyer FOREIGN KEY (lawyer_id) REFERENCES public.lawyers(id) ON DELETE SET NULL;


--
-- Name: case_clients fk_cc_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_clients
    ADD CONSTRAINT fk_cc_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_clients fk_cc_client; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_clients
    ADD CONSTRAINT fk_cc_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: case_interns fk_ci_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_interns
    ADD CONSTRAINT fk_ci_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_interns fk_ci_intern; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_interns
    ADD CONSTRAINT fk_ci_intern FOREIGN KEY (intern_id) REFERENCES public.interns(id) ON DELETE CASCADE;


--
-- Name: consultation_meetings fk_cm_consultation; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.consultation_meetings
    ADD CONSTRAINT fk_cm_consultation FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE;


--
-- Name: case_notes fk_cn_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_notes
    ADD CONSTRAINT fk_cn_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_notes fk_cn_intern; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_notes
    ADD CONSTRAINT fk_cn_intern FOREIGN KEY (author_intern) REFERENCES public.interns(id) ON DELETE SET NULL;


--
-- Name: case_notes fk_cn_lawyer; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_notes
    ADD CONSTRAINT fk_cn_lawyer FOREIGN KEY (author_lawyer) REFERENCES public.lawyers(id) ON DELETE SET NULL;


--
-- Name: consultations fk_cons_client; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT fk_cons_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: consultations fk_cons_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT fk_cons_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: consultations fk_cons_lawyer; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT fk_cons_lawyer FOREIGN KEY (lawyer_id) REFERENCES public.lawyers(id) ON DELETE SET NULL;


--
-- Name: case_opposing_party fk_cop_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_opposing_party
    ADD CONSTRAINT fk_cop_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_opposing_party fk_cop_client; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_opposing_party
    ADD CONSTRAINT fk_cop_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: case_tasks fk_ct_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_tasks
    ADD CONSTRAINT fk_ct_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_tasks fk_ct_intern; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_tasks
    ADD CONSTRAINT fk_ct_intern FOREIGN KEY (assigned_to_intern) REFERENCES public.interns(id) ON DELETE SET NULL;


--
-- Name: case_tasks fk_ct_lawyer; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.case_tasks
    ADD CONSTRAINT fk_ct_lawyer FOREIGN KEY (assigned_to_lawyer) REFERENCES public.lawyers(id) ON DELETE SET NULL;


--
-- Name: document_checklist fk_dc_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.document_checklist
    ADD CONSTRAINT fk_dc_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: document_checklist fk_dc_document; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.document_checklist
    ADD CONSTRAINT fk_dc_document FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: documents fk_doc_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_doc_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: documents fk_doc_client; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_doc_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: documents fk_doc_intern; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_doc_intern FOREIGN KEY (uploaded_by_intern) REFERENCES public.interns(id) ON DELETE SET NULL;


--
-- Name: documents fk_doc_lawyer; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_doc_lawyer FOREIGN KEY (uploaded_by_lawyer) REFERENCES public.lawyers(id) ON DELETE SET NULL;


--
-- Name: hearings fk_hearing_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.hearings
    ADD CONSTRAINT fk_hearing_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: hearings fk_hearing_court; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.hearings
    ADD CONSTRAINT fk_hearing_court FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE SET NULL;


--
-- Name: invoice_line_items fk_ili_invoice; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT fk_ili_invoice FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: interns fk_intern_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.interns
    ADD CONSTRAINT fk_intern_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: invoices fk_inv_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_inv_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;


--
-- Name: invoices fk_inv_client; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_inv_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: invoices fk_inv_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_inv_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: intern_permissions fk_ip_intern; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.intern_permissions
    ADD CONSTRAINT fk_ip_intern FOREIGN KEY (intern_id) REFERENCES public.interns(id) ON DELETE CASCADE;


--
-- Name: interaction_summaries fk_is_approved_by; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.interaction_summaries
    ADD CONSTRAINT fk_is_approved_by FOREIGN KEY (approved_by) REFERENCES public.lawyers(id) ON DELETE SET NULL;


--
-- Name: interaction_summaries fk_is_consultation; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.interaction_summaries
    ADD CONSTRAINT fk_is_consultation FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE;


--
-- Name: interaction_summaries fk_is_created_by_intern; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.interaction_summaries
    ADD CONSTRAINT fk_is_created_by_intern FOREIGN KEY (created_by_intern) REFERENCES public.interns(id) ON DELETE SET NULL;


--
-- Name: interaction_summaries fk_is_created_by_lawyer; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.interaction_summaries
    ADD CONSTRAINT fk_is_created_by_lawyer FOREIGN KEY (created_by_lawyer) REFERENCES public.lawyers(id) ON DELETE SET NULL;


--
-- Name: interaction_summaries fk_is_meeting; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.interaction_summaries
    ADD CONSTRAINT fk_is_meeting FOREIGN KEY (meeting_id) REFERENCES public.consultation_meetings(id) ON DELETE SET NULL;


--
-- Name: lawyers fk_lawyer_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawyers
    ADD CONSTRAINT fk_lawyer_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: lawfirm_courts fk_lc_court; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_courts
    ADD CONSTRAINT fk_lc_court FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE CASCADE;


--
-- Name: lawfirm_courts fk_lc_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_courts
    ADD CONSTRAINT fk_lc_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: lawfirm_contact_details fk_lcd_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_contact_details
    ADD CONSTRAINT fk_lcd_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: lawfirm_practice_areas fk_lpa_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_practice_areas
    ADD CONSTRAINT fk_lpa_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: lawfirm_practice_areas fk_lpa_practice_area; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawfirm_practice_areas
    ADD CONSTRAINT fk_lpa_practice_area FOREIGN KEY (practice_area_id) REFERENCES public.practice_areas(id) ON DELETE CASCADE;


--
-- Name: lawyer_specializations fk_ls_lawyer; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawyer_specializations
    ADD CONSTRAINT fk_ls_lawyer FOREIGN KEY (lawyer_id) REFERENCES public.lawyers(id) ON DELETE CASCADE;


--
-- Name: lawyer_specializations fk_ls_practice_area; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.lawyer_specializations
    ADD CONSTRAINT fk_ls_practice_area FOREIGN KEY (practice_area_id) REFERENCES public.practice_areas(id) ON DELETE CASCADE;


--
-- Name: messages fk_msg_client; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_msg_client FOREIGN KEY (sender_client) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: messages fk_msg_intern; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_msg_intern FOREIGN KEY (sender_intern) REFERENCES public.interns(id) ON DELETE SET NULL;


--
-- Name: messages fk_msg_lawyer; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_msg_lawyer FOREIGN KEY (sender_lawyer) REFERENCES public.lawyers(id) ON DELETE SET NULL;


--
-- Name: messages fk_msg_thread; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_msg_thread FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE CASCADE;


--
-- Name: message_threads fk_mt_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT fk_mt_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: message_threads fk_mt_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT fk_mt_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: notifications fk_notif_client; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notif_client FOREIGN KEY (recipient_client) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: notifications fk_notif_intern; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notif_intern FOREIGN KEY (recipient_intern) REFERENCES public.interns(id) ON DELETE CASCADE;


--
-- Name: notifications fk_notif_lawyer; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notif_lawyer FOREIGN KEY (recipient_lawyer) REFERENCES public.lawyers(id) ON DELETE CASCADE;


--
-- Name: schedule_events fk_se_case; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.schedule_events
    ADD CONSTRAINT fk_se_case FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: schedule_events fk_se_intern; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.schedule_events
    ADD CONSTRAINT fk_se_intern FOREIGN KEY (created_by_intern) REFERENCES public.interns(id) ON DELETE SET NULL;


--
-- Name: schedule_events fk_se_lawfirm; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.schedule_events
    ADD CONSTRAINT fk_se_lawfirm FOREIGN KEY (lawfirm_id) REFERENCES public.lawfirm_meta(id) ON DELETE CASCADE;


--
-- Name: schedule_events fk_se_lawyer; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.schedule_events
    ADD CONSTRAINT fk_se_lawyer FOREIGN KEY (created_by_lawyer) REFERENCES public.lawyers(id) ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: admin
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict vd7ICGjz56ldQ27E98h83iGQ8PIhu2E05PcqXaq3upZgWJq07DWPWMh1CtewdwC

