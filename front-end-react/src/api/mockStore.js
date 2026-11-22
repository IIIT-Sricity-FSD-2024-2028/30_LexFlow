/**
 * mockStore.js - Persistent client-side data store for LexFlow.
 *
 * Implements the authentic seed data for Law Firms, Consultations, Cases,
 * and Users from the LexFlow specification, preserving data across sessions
 * in localStorage so the client → firm consultation request workflow works seamlessly.
 */

import { verifyBarNumber, verifyAadhaar, formatAadhaar } from '../lib/validators.js';

export const INITIAL_FIRMS = [
  {
    id: 'firm-1',
    name: 'Sharma & Associates',
    subtitle: 'Corporate Law & Civil Litigation • New Delhi',
    description: 'Sharma & Associates is a leading law firm based in New Delhi. Specializing in Corporate Law, Civil Litigation, Arbitration, and Property Disputes. Verified and registered on the LexFlow platform.',
    location: 'new-delhi',
    locationLabel: 'New Delhi',
    city: 'New Delhi',
    practiceArea: 'corporate',
    practiceAreas: ['Corporate Law', 'Civil Litigation', 'Arbitration', 'Property Dispute'],
    availability: 'AVAILABLE',
    rating: 0,
    reviews: 0,
    price: 250,
    experience: '15+ Years',
    bio: 'Headquartered at 21, Connaught Place, New Delhi. Over 15 years of distinguished practice in corporate governance, commercial disputes, and property litigation.',
    languages: ['English (Fluent)', 'Hindi (Fluent)'],
    tier: 'Growth',
    email: 'contact@sharma.law',
    phone: '+91 98765 43210',
    street: '21, Connaught Place',
    address: '21, Connaught Place, New Delhi',
    avatarColor: 'blue',
  },
  {
    id: 'firm-2',
    name: 'Khanna & Co',
    subtitle: 'Family Law & Civil Dispute • Mumbai',
    description: 'Khanna & Co is an established practice in Mumbai specializing in Family Law, Property Disputes, and Civil Mediation.',
    location: 'mumbai',
    locationLabel: 'Mumbai',
    city: 'Mumbai',
    practiceArea: 'family',
    practiceAreas: ['Family Law', 'Property Dispute', 'Divorce & Custody'],
    availability: 'AVAILABLE',
    rating: 4.9,
    reviews: 98,
    price: 300,
    experience: '18+ Years',
    bio: 'Based in Nariman Point, Mumbai. Dedicated to client confidentiality, sensitive conflict resolution, and high-stakes family law mediation.',
    languages: ['English (Fluent)', 'Hindi (Fluent)', 'Marathi (Fluent)'],
    tier: 'Growth',
    email: 'info@khanna.law',
    phone: '+91 98765 43211',
    street: '14, Nariman Point',
    address: 'Nariman Point, Mumbai',
    avatarColor: 'green',
  },
  {
    id: 'firm-3',
    name: 'Tech Legal Bangalore',
    subtitle: 'IP, Tech & Startup Advisory • Bangalore',
    description: 'Premier technology and intellectual property law firm serving tech companies, founders, and inventors across India.',
    location: 'bangalore',
    locationLabel: 'Bangalore',
    city: 'Bangalore',
    practiceArea: 'intellectual-property',
    practiceAreas: ['IP & Trademark', 'Startup Advisory', 'Cyber Law', 'Corporate'],
    availability: 'AVAILABLE',
    rating: 4.7,
    reviews: 76,
    price: 350,
    experience: '12+ Years',
    bio: 'Headquartered on MG Road, Bangalore. Focused on patent filings, trademark protection, venture financing contracts, and regulatory tech compliance.',
    languages: ['English (Fluent)', 'Kannada (Fluent)', 'Hindi (Fluent)'],
    tier: 'Growth',
    email: 'blr@techlegal.test',
    phone: '+91 98765 43212',
    street: '45, MG Road',
    address: 'MG Road, Bangalore',
    avatarColor: 'purple',
  },
  {
    id: 'firm-4',
    name: 'Coastal Legal Chennai',
    subtitle: 'Labor, Employment & Commercial • Chennai',
    description: 'Specialists in employment law, workplace compliance, and maritime/commercial disputes along the eastern corridor.',
    location: 'chennai',
    locationLabel: 'Chennai',
    city: 'Chennai',
    practiceArea: 'employment',
    practiceAreas: ['Labor & Employment', 'Civil Law', 'Commercial Contracts'],
    availability: 'AVAILABLE',
    rating: 4.6,
    reviews: 54,
    price: 200,
    experience: '14+ Years',
    bio: 'Located on Marina Beach Road, Chennai. Decades of combined experience representing organizations and individuals in employment tribunals.',
    languages: ['English (Fluent)', 'Tamil (Fluent)', 'Hindi'],
    tier: 'Growth',
    email: 'chennai@coastal.test',
    phone: '+91 98765 43213',
    street: '12, Marina Beach Road',
    address: 'Marina Beach Road, Chennai',
    avatarColor: 'teal',
  },
  {
    id: 'firm-5',
    name: 'Cyber Law Experts Hyderabad',
    subtitle: 'Cyber Crime, Privacy & Data Protection • Hyderabad',
    description: 'Specialized niche practice for data privacy violations, cloud security legalities, and cyber dispute litigation.',
    location: 'hyderabad',
    locationLabel: 'Hyderabad',
    city: 'Hyderabad',
    practiceArea: 'cyber',
    practiceAreas: ['Cyber Crime', 'Data Privacy', 'IT Contracts', 'Fintech Law'],
    availability: 'AVAILABLE',
    rating: 4.8,
    reviews: 88,
    price: 280,
    experience: '10+ Years',
    bio: 'Situated in Hitech City, Hyderabad. Trusted legal advisors for multinational tech centers, SaaS providers, and individual digital rights.',
    languages: ['English (Fluent)', 'Telugu (Fluent)', 'Hindi (Fluent)'],
    tier: 'Growth',
    email: 'hyd@cyber.test',
    phone: '+91 98765 43214',
    street: '8, Hitech City',
    address: 'Hitech City, Hyderabad',
    avatarColor: 'orange',
  },
];

export const INITIAL_CONSULTATIONS = [
  // Client Alice (cl-1) consultations
  {
    id: 'CONS-882',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    lawyerId: 'lw-1',
    lawyerName: 'Lawyer Bob',
    type: 'video',
    date: 'May 24, 2026',
    time: '10:30 AM - 11:00 AM',
    status: 'SCHEDULED',
    caseDescription: 'Property dispute with neighbor regarding boundary fence and land encroachment.',
    consultationFee: '₹250',
    avatarClass: 'blue',
    bookedViaWorkflow: false,
  },
  {
    id: 'CONS-895',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    firmId: 'firm-2',
    firmName: 'Khanna & Co',
    lawyerId: 'lw-4',
    lawyerName: 'Lawyer Rahul',
    type: 'inperson',
    date: 'May 26, 2026',
    time: '02:00 PM - 03:00 PM',
    status: 'CONFIRMED',
    caseDescription: 'Family custody arrangement and child support consultation.',
    consultationFee: '₹200',
    avatarClass: 'green',
    bookedViaWorkflow: false,
  },
  {
    id: 'CONS-901',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    firmId: 'firm-4',
    firmName: 'Coastal Legal Chennai',
    lawyerId: 'lw-10',
    lawyerName: 'Lawyer Elena',
    type: 'chat',
    date: 'Jun 02, 2026',
    time: '11:00 AM - 11:30 AM',
    status: 'CONFIRMED',
    caseDescription: 'Employment contract review before signing new job offer.',
    consultationFee: '₹180',
    avatarClass: 'indigo',
    bookedViaWorkflow: true,
  },
  {
    id: 'CONS-907',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    type: 'video',
    date: 'Jun 10, 2026',
    time: '03:00 PM - 03:30 PM',
    status: 'PENDING',
    caseDescription: 'Tenant rights dispute — landlord refusing to return security deposit.',
    consultationFee: '₹250',
    avatarClass: 'orange',
    bookedViaWorkflow: false,
  },
  {
    id: 'CONS-204',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    lawyerId: 'lw-2',
    lawyerName: 'Lawyer Amit',
    type: 'video',
    date: 'Mar 14, 2026',
    time: '09:00 AM - 09:30 AM',
    status: 'COMPLETED',
    caseDescription: 'Property law consultation — boundary regulations resolved.',
    consultationFee: '₹250',
    avatarClass: 'orange',
    bookedViaWorkflow: false,
    notes: 'Client advised on property boundary regulations. Case closed successfully.',
  },
  {
    id: 'CONS-156',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    firmId: 'firm-3',
    firmName: 'Tech Legal Bangalore',
    type: 'chat',
    date: 'Jan 10, 2026',
    time: '04:00 PM - 04:30 PM',
    status: 'CANCELLED',
    caseDescription: 'Civil law matter — client cancelled due to scheduling conflict.',
    avatarClass: 'purple',
    bookedViaWorkflow: false,
  },
  {
    id: 'CONS-143',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    firmId: 'firm-2',
    firmName: 'Khanna & Co',
    lawyerId: 'lw-5',
    lawyerName: 'Lawyer Priya',
    type: 'inperson',
    date: 'Feb 20, 2026',
    time: '10:00 AM - 11:00 AM',
    status: 'COMPLETED',
    caseDescription: 'Initial family mediation session — divorce proceedings.',
    consultationFee: '₹200',
    avatarClass: 'teal',
    bookedViaWorkflow: false,
    notes: 'Mediation session completed. Follow-up scheduled.',
  },
  {
    id: 'CONS-118',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    lawyerId: 'lw-3',
    lawyerName: 'Lawyer Sunita',
    type: 'video',
    date: 'Nov 05, 2025',
    time: '01:00 PM - 01:30 PM',
    status: 'COMPLETED',
    caseDescription: 'Intellectual property — trademark registration advisory.',
    consultationFee: '₹300',
    avatarClass: 'blue',
  },
  // Additional incoming requests for Firm 1 (Sharma & Associates)
  {
    id: 'CONS-910',
    clientId: 'cl-3',
    clientName: 'Client Dave',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    type: 'chat',
    date: 'May 28, 2026',
    time: '11:00 AM - 11:30 AM',
    status: 'PENDING',
    caseDescription: 'Criminal defense consultation — charges being filed against client.',
    consultationFee: '₹250',
    avatarClass: 'indigo',
    bookedViaWorkflow: true,
  },
  {
    id: 'CONS-911',
    clientId: 'cl-4',
    clientName: 'Client Eve',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    type: 'inperson',
    date: 'May 29, 2026',
    time: '03:00 PM - 04:00 PM',
    status: 'PENDING',
    caseDescription: 'Corporate contract review needed urgently before board meeting.',
    consultationFee: '₹250',
    avatarClass: 'teal',
    bookedViaWorkflow: true,
  },
  {
    id: 'CONS-912',
    clientId: 'cl-5',
    clientName: 'Client Frank',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    type: 'video',
    date: 'Jun 01, 2026',
    time: '09:00 AM - 09:30 AM',
    status: 'PENDING',
    caseDescription: 'Startup equity and co-founder agreement drafting assistance.',
    consultationFee: '₹250',
    avatarClass: 'green',
    bookedViaWorkflow: true,
  },
  {
    id: 'CONS-913',
    clientId: 'cl-6',
    clientName: 'Client Grace',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    type: 'chat',
    date: 'Jun 03, 2026',
    time: '02:00 PM - 02:30 PM',
    status: 'PENDING',
    caseDescription: 'Insurance claim denial — seeking legal opinion on recourse options.',
    consultationFee: '₹250',
    avatarClass: 'purple',
    bookedViaWorkflow: false,
  },
];

export const INITIAL_CASES = [
  {
    id: 1,
    cnr: '100001',
    case_type: 'Criminal',
    title: 'State vs John Doe - Narcotics case',
    brief_description: 'State vs John Doe - Narcotics case',
    status: 'Active',
    filed_date: '2024-01-15',
    filing_date: '2024-01-15',
    court: 'Sessions Court, New Delhi',
    stage: 'Cross Examination',
    progress: 65,
    nextHearing: {
      date: '10 Dec 2026',
      time: '10:30 AM',
      court: 'Court Room 4, Sessions Court',
      purpose: 'Witness Cross Examination',
    },
    timeline: [
      { date: '15 Jan 2024', title: 'Case Filed', description: 'Chargesheet submitted by prosecution' },
      { date: '10 Mar 2024', title: 'Charges Framed', description: 'Section 21 NDPS Act invoked' },
      { date: '15 Sep 2024', title: 'Bail Hearing', description: 'Conditional bail granted' },
    ],
    lawfirm_id: 'firm-1',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    client_id: 'cl-1',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    lawyer_id: 'lw-1',
    lawyerId: 'lw-1',
    lawyerName: 'Lawyer Bob',
    opposingParty: 'State of Maharashtra',
  },
  {
    id: 2,
    cnr: '100002',
    case_type: 'Civil',
    title: 'Property dispute - Sharma vs Gupta',
    brief_description: 'Property dispute - Sharma vs Gupta',
    status: 'Active',
    filed_date: '2024-02-20',
    filing_date: '2024-02-20',
    court: 'Delhi High Court',
    stage: 'Evidence Stage',
    progress: 40,
    nextHearing: {
      date: '18 Dec 2026',
      time: '11:15 AM',
      court: 'Court Hall 2, Delhi High Court',
      purpose: 'Plaintiff Evidence Recording',
    },
    timeline: [
      { date: '20 Feb 2024', title: 'Plaint Filed', description: 'Injunction suit filed with site map' },
      { date: '12 Apr 2024', title: 'Written Statement', description: 'Defendant submitted reply' },
      { date: '05 Aug 2024', title: 'Issues Framed', description: 'Title and possession issues framed' },
    ],
    lawfirm_id: 'firm-1',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    client_id: 'cl-1',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    lawyer_id: 'lw-1',
    lawyerId: 'lw-1',
    lawyerName: 'Lawyer Bob',
    opposingParty: 'Gupta Estates Pvt Ltd',
  },
  {
    id: 3,
    cnr: '100003',
    case_type: 'Corporate',
    title: 'Contract breach - TechCorp vs SoftSystems',
    brief_description: 'Contract breach - TechCorp vs SoftSystems',
    status: 'Pending',
    filed_date: '2024-03-05',
    filing_date: '2024-03-05',
    court: 'Commercial Court, New Delhi',
    stage: 'Admission Stage',
    progress: 20,
    nextHearing: {
      date: '12 Jan 2027',
      time: '02:30 PM',
      court: 'Commercial Bench 1',
      purpose: 'Preliminary Objections',
    },
    timeline: [
      { date: '05 Mar 2024', title: 'Arbitration Notice', description: 'Breach of SLA notice issued' },
      { date: '20 Apr 2024', title: 'Suit Instituted', description: 'Commercial suit filed for damages' },
    ],
    lawfirm_id: 'firm-1',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    client_id: 'cl-1',
    clientId: 'cl-1',
    clientName: 'Client Alice',
    lawyer_id: 'lw-1',
    lawyerId: 'lw-1',
    lawyerName: 'Lawyer Bob',
    opposingParty: 'SoftSystems Ltd',
  },
];

export const INITIAL_USERS = [
  {
    id: '5432-8765-4321', // Aadhaar card as primary key for client (12 numbers in 4-4-4 format)
    aadhaar: '5432-8765-4321',
    aadhaarNumber: '5432-8765-4321',
    clientId: '5432-8765-4321',
    userId: '5432-8765-4321',
    legacyId: 'cl-1',
    name: 'Client Alice',
    fullName: 'Client Alice',
    email: 'alice@client.test',
    password: 'clientpass',
    role: 'client',
    firmId: 'firm-1',
    phone: '9876500001',
    contactNumber: '+91 98765 00001',
    address: '14, Lodhi Road, New Delhi',
    clientType: 'Individual',
  },
  {
    id: 'fa-1',
    name: 'Rajesh Sharma',
    fullName: 'Rajesh Sharma',
    email: 'firmadmin@lexflow.test',
    password: 'firmadminpass',
    role: 'firmAdmin',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    phone: '+91 98765 43210',
  },
  {
    id: 'lw-1',
    name: 'Lawyer Bob',
    fullName: 'Lawyer Bob',
    email: 'bob@lawyer.test',
    password: 'lawyerpass',
    role: 'lawyer',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    phone: '+91 98765 43215',
    barNumber: 'MAH/1234/2018',
    barEnrollmentNumber: 'MAH/1234/2018',
    barCouncilId: 'MAH/1234/2018',
    barCouncil: 'Bar Council of Maharashtra & Goa',
    experience: 15,
  },
  {
    id: 'lw-2',
    name: 'Lawyer Amit',
    fullName: 'Lawyer Amit',
    email: 'amit@sharma.law',
    password: 'lawyerpass',
    role: 'lawyer',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    phone: '+91 98765 43216',
    barNumber: 'DL/5678/2015',
    barEnrollmentNumber: 'DL/5678/2015',
    barCouncilId: 'DL/5678/2015',
    barCouncil: 'Bar Council of Delhi',
    experience: 12,
  },
  {
    id: 'lw-3',
    name: 'Lawyer Sunita',
    fullName: 'Lawyer Sunita',
    email: 'sunita@sharma.law',
    password: 'lawyerpass',
    role: 'lawyer',
    firmId: 'firm-1',
    firmName: 'Sharma & Associates',
    phone: '+91 98765 43217',
    barNumber: 'KAR/9012/2020',
    barEnrollmentNumber: 'KAR/9012/2020',
    barCouncilId: 'KAR/9012/2020',
    barCouncil: 'Bar Council of Karnataka',
    experience: 8,
  },
  {
    id: 'sa-1',
    name: 'Super Admin',
    fullName: 'Super Admin',
    email: 'superadmin@lexflow.test',
    password: 'superadminpass',
    role: 'superAdmin',
  },
];

export const INITIAL_INVOICES = [
  {
    id: 'INV-9821A',
    clientId: '5432-8765-4321',
    clientName: 'Alice Client',
    clientEmail: 'alice@client.test',
    clientAadhaar: '5432-8765-4321',
    firmId: 'firm-1',
    caseName: 'Sharma Tech Solutions Merger',
    advocateName: 'Adv. Lawyer Bob',
    amount: 25000,
    status: 'Pending',
    dueDate: '2026-12-05',
    createdAt: '2026-11-15T10:00:00.000Z',
  },
  {
    id: 'INV-8412B',
    clientId: '5432-8765-4321',
    clientName: 'Alice Client',
    clientEmail: 'alice@client.test',
    clientAadhaar: '5432-8765-4321',
    firmId: 'firm-1',
    caseName: 'Corporate Restructuring Retainer',
    advocateName: 'Adv. Lawyer Bob',
    amount: 15000,
    status: 'Paid',
    dueDate: '2026-11-10',
    createdAt: '2026-11-01T09:30:00.000Z',
  },
  {
    id: 'INV-7341C',
    clientId: '5432-8765-4321',
    clientName: 'Alice Client',
    clientEmail: 'alice@client.test',
    clientAadhaar: '5432-8765-4321',
    firmId: 'firm-2',
    caseName: 'Property Title Due Diligence',
    advocateName: 'Adv. Sarah Jenkins',
    amount: 8000,
    status: 'Overdue',
    dueDate: '2026-11-15',
    createdAt: '2026-10-25T14:15:00.000Z',
  },
  {
    id: 'INV-6190D',
    clientId: 'cl-2',
    clientName: 'Rahul Mehta',
    clientEmail: 'rahul.mehta@enterprise.com',
    clientAadhaar: '9876-5432-1098',
    firmId: 'firm-1',
    caseName: 'Commercial Lease Dispute',
    advocateName: 'Adv. Priya Sharma',
    amount: 32000,
    status: 'Pending',
    dueDate: '2026-12-10',
    createdAt: '2026-11-18T11:00:00.000Z',
  },
  {
    id: 'INV-5520E',
    clientId: 'cl-3',
    clientName: 'Sneha Rao',
    clientEmail: 'sneha@biotech.io',
    clientAadhaar: '1234-9876-5432',
    firmId: 'firm-3',
    caseName: 'Patent Application Filing',
    advocateName: 'Adv. Amit Verma',
    amount: 45000,
    status: 'Paid',
    dueDate: '2026-11-12',
    createdAt: '2026-11-02T16:00:00.000Z',
  },
];

export const INITIAL_PAYMENTS = [
  {
    id: 'PAY-1001',
    invoiceId: 'INV-8412B',
    clientId: '5432-8765-4321',
    clientName: 'Alice Client',
    clientAadhaar: '5432-8765-4321',
    firmId: 'firm-1',
    amount: 15000,
    paymentDate: '2026-11-10',
    paymentMethod: 'Credit Card',
    status: 'Completed',
  },
  {
    id: 'PAY-1002',
    invoiceId: 'INV-5520E',
    clientId: 'cl-3',
    clientName: 'Sneha Rao',
    clientAadhaar: '1234-9876-5432',
    firmId: 'firm-3',
    amount: 45000,
    paymentDate: '2026-11-12',
    paymentMethod: 'UPI',
    status: 'Completed',
  },
];

class MockStore {
  constructor() {
    this.ensureInitialized();
  }

  ensureInitialized() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      if (localStorage.getItem('lexflow_store_seeded') !== 'v6') {
        localStorage.setItem('lexflow_firms', JSON.stringify(INITIAL_FIRMS));
        localStorage.setItem('lexflow_consultations', JSON.stringify(INITIAL_CONSULTATIONS));
        localStorage.setItem('lexflow_cases', JSON.stringify(INITIAL_CASES));
        localStorage.setItem('lexflow_users', JSON.stringify(INITIAL_USERS));
        localStorage.setItem('lexflow_invoices', JSON.stringify(INITIAL_INVOICES));
        localStorage.setItem('lexflow_payments', JSON.stringify(INITIAL_PAYMENTS));
        localStorage.setItem('lexflow_store_seeded', 'v6');
      }
    } catch (e) {
      console.warn('[MockStore] Failed to initialize storage:', e);
    }
  }

  _read(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  _write(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`[MockStore] Failed to write ${key}:`, e);
    }
  }

  login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this._read('lexflow_users', INITIAL_USERS);
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user || user.password !== password) {
      throw new Error('Invalid email or password.');
    }
    const { password: _, ...userSafe } = user;
    localStorage.setItem('access_token', `demo_jwt_${user.id}_${Date.now()}`);
    return userSafe;
  }

  getFirms(filters = {}) {
    let list = this._read('lexflow_firms', INITIAL_FIRMS);
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(kw) ||
          f.subtitle.toLowerCase().includes(kw) ||
          f.description.toLowerCase().includes(kw) ||
          (f.practiceAreas || []).some((p) => p.toLowerCase().includes(kw))
      );
    }
    if (filters.location && filters.location !== 'all') {
      const loc = filters.location.toLowerCase();
      list = list.filter((f) => (f.location || '').toLowerCase() === loc);
    }
    if (filters.practiceArea && filters.practiceArea !== 'all') {
      const pa = filters.practiceArea.toLowerCase();
      list = list.filter((f) =>
        (f.practiceAreas || []).some((p) => p.toLowerCase().includes(pa))
      );
    }
    return list;
  }

  getFirmById(id) {
    const list = this._read('lexflow_firms', INITIAL_FIRMS);
    return list.find((f) => f.id === id || String(f.id) === String(id)) || null;
  }

  getConsultations(filters = {}, role = '') {
    let list = this._read('lexflow_consultations', INITIAL_CONSULTATIONS);
    const r = (role || '').toLowerCase();

    if (filters.clientId) {
      list = list.filter((c) => c.clientId === filters.clientId);
    }
    if (filters.firmId) {
      list = list.filter((c) => c.firmId === filters.firmId || c.firmId === `firm-${filters.firmId}`);
    }
    if (filters.lawyerId) {
      list = list.filter((c) => c.lawyerId === filters.lawyerId);
    }
    if (r === 'lawyer' && filters.lawyerId) {
      list = list.filter((c) => c.lawyerId === filters.lawyerId);
    }
    return list;
  }

  getClientConsultations(clientId) {
    const list = this._read('lexflow_consultations', INITIAL_CONSULTATIONS);
    return list.filter((c) => c.clientId === clientId);
  }

  createConsultation(data) {
    const list = this._read('lexflow_consultations', INITIAL_CONSULTATIONS);
    const newRecord = {
      id: `CONS-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    list.unshift(newRecord);
    this._write('lexflow_consultations', list);

    // Auto-create consultation invoice in billing so client can pay immediately
    try {
      const invoices = this._read('lexflow_invoices', INITIAL_INVOICES);
      const feeNum = parseFloat(String(data.consultationFee || '250').replace(/[^0-9.]/g, '')) || 250;
      const invId = `INV-${Math.floor(1000 + Math.random() * 9000)}C`;
      const consultationInvoice = {
        id: invId,
        clientId: data.clientId || data.clientAadhaar || 'cl-draft-1',
        clientName: data.clientName || 'Client',
        clientEmail: data.clientEmail || '',
        clientAadhaar: data.clientAadhaar || (data.clientId && data.clientId.includes('-') ? data.clientId : ''),
        firmId: data.firmId || 'firm-1',
        caseName: `Consultation Fee: ${data.firmName || data.type || 'Legal Advisory'}`,
        advocateName: data.lawyerName || 'Firm Counsel',
        amount: feeNum,
        status: 'Pending',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };
      invoices.unshift(consultationInvoice);
      this._write('lexflow_invoices', invoices);
    } catch (e) {
      console.warn('[MockStore] Could not auto-generate invoice for consultation:', e);
    }

    return newRecord;
  }

  updateConsultation(id, updates) {
    const list = this._read('lexflow_consultations', INITIAL_CONSULTATIONS);
    const index = list.findIndex((c) => c.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates, updatedAt: new Date().toISOString() };
      this._write('lexflow_consultations', list);
      return list[index];
    }
    return null;
  }

  cancelConsultation(id) {
    return this.updateConsultation(id, { status: 'CANCELLED' });
  }

  getCases(filters = {}, role = '') {
    let list = this._read('lexflow_cases', INITIAL_CASES);
    if (filters.clientId) {
      list = list.filter((c) => c.client_id === filters.clientId || c.clientId === filters.clientId);
    }
    if (filters.firmId) {
      list = list.filter((c) => c.lawfirm_id === filters.firmId || c.firmId === filters.firmId);
    }
    if (filters.lawyerId) {
      list = list.filter((c) => c.lawyer_id === filters.lawyerId || c.lawyerId === filters.lawyerId);
    }
    return list;
  }

  getCaseById(id) {
    const list = this._read('lexflow_cases', INITIAL_CASES);
    return list.find((c) => String(c.id) === String(id) || c.cnr === String(id)) || null;
  }

  updateCase(id, updates) {
    const list = this._read('lexflow_cases', INITIAL_CASES);
    const index = list.findIndex((c) => String(c.id) === String(id) || String(c.cnr) === String(id));
    if (index !== -1) {
      list[index] = { ...list[index], ...updates };
      this._write('lexflow_cases', list);
      return list[index];
    }
    return updates;
  }

  getLawyers(firmId) {
    const users = this._read('lexflow_users', INITIAL_USERS);
    return users.filter(
      (u) =>
        (u.role || '').toLowerCase() === 'lawyer' &&
        (!firmId || u.firmId === firmId || u.firmId === `firm-${firmId}`)
    );
  }

  getUserById(id) {
    const users = this._read('lexflow_users', INITIAL_USERS);
    return users.find((u) => u.id === id || u.userId === id || u.clientId === id || u.aadhaar === id || u.legacyId === id) || null;
  }

  getUsers(filters = {}) {
    let list = this._read('lexflow_users', INITIAL_USERS);
    if (filters.role) {
      list = list.filter((u) => (u.role || '').toLowerCase() === filters.role.toLowerCase());
    }
    if (filters.firmId) {
      list = list.filter((u) => u.firmId === filters.firmId || u.firmId === `firm-${filters.firmId}`);
    }
    return list;
  }

  getUsersByFirm(firmId) {
    const users = this._read('lexflow_users', INITIAL_USERS);
    return users.filter((u) => !firmId || u.firmId === firmId || u.firmId === `firm-${firmId}`);
  }

  createUser(data) {
    const users = this._read('lexflow_users', INITIAL_USERS);
    const role = (data.role || '').toLowerCase();
    let id = data.id;

    // Aadhaar card as primary key for clients (12 numbers in 4-4-4 format)
    let aadhaar = data.aadhaar || data.aadhaarNumber;
    if (role === 'client') {
      if (!aadhaar) {
        const rand = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        aadhaar = `${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;
      } else {
        aadhaar = formatAadhaar(aadhaar);
      }
      id = aadhaar; // Aadhaar card is primary key
    } else if (!id) {
      const prefix = role === 'lawyer' ? 'lw' : role === 'intern' ? 'in' : role === 'firmadmin' ? 'fa' : 'u';
      id = `${prefix}-${Date.now()}`;
    }

    let barDetails = {};
    if (role === 'lawyer' && (data.barNumber || data.barEnrollmentNumber)) {
      const rawBar = data.barNumber || data.barEnrollmentNumber;
      const v = verifyBarNumber(rawBar);
      if (v.isValid) {
        barDetails = {
          barNumber: v.barNumber,
          barEnrollmentNumber: v.barNumber,
          barCouncilId: v.barNumber,
          barCouncil: v.council,
        };
      } else {
        barDetails = {
          barNumber: rawBar,
          barEnrollmentNumber: rawBar,
          barCouncilId: rawBar,
        };
      }
    }

    const newUser = {
      id,
      userId: id,
      clientId: role === 'client' ? id : undefined,
      aadhaar: role === 'client' ? aadhaar : undefined,
      aadhaarNumber: role === 'client' ? aadhaar : undefined,
      name: data.fullName || data.name || '',
      fullName: data.fullName || data.name || '',
      email: (data.email || '').toLowerCase(),
      role: data.role || (role === 'client' ? 'client' : 'lawyer'),
      phone: data.phone || '',
      accountStatus: data.accountStatus || 'active',
      availability: data.availability || 'available',
      firmId: data.firmId || 'firm-1',
      createdAt: new Date().toISOString(),
      ...barDetails,
      ...data,
      id,
    };

    users.push(newUser);
    this._write('lexflow_users', users);
    return newUser;
  }

  updateUser(id, updates) {
    const users = this._read('lexflow_users', INITIAL_USERS);
    const index = users.findIndex((u) => u.id === id || u.aadhaar === id || u.clientId === id || u.legacyId === id);
    if (index !== -1) {
      let barDetails = {};
      if (updates.barNumber || updates.barEnrollmentNumber) {
        const rawBar = updates.barNumber || updates.barEnrollmentNumber;
        const v = verifyBarNumber(rawBar);
        if (v.isValid) {
          barDetails = {
            barNumber: v.barNumber,
            barEnrollmentNumber: v.barNumber,
            barCouncilId: v.barNumber,
            barCouncil: v.council,
          };
        }
      }
      users[index] = { ...users[index], ...updates, ...barDetails, updatedAt: new Date().toISOString() };
      this._write('lexflow_users', users);
      return users[index];
    }
    return null;
  }

  deleteUser(id) {
    let users = this._read('lexflow_users', INITIAL_USERS);
    users = users.filter((u) => u.id !== id && u.aadhaar !== id && u.clientId !== id && u.legacyId !== id);
    this._write('lexflow_users', users);
    return { success: true, id };
  }

  /* ────────────────── BILLING & PAYMENTS ────────────────── */

  getInvoices(role = 'client', headers = {}) {
    let list = this._read('lexflow_invoices', INITIAL_INVOICES);
    const userId = (headers['x-user-id'] || '').trim();
    const userName = (headers['x-user-name'] || '').trim().toLowerCase();
    const r = (role || '').toLowerCase();

    if (r === 'client') {
      if (!userId && !userName) return list;
      let userInvoices = list.filter((inv) => {
        const idMatch = userId && (
          inv.clientId === userId ||
          inv.clientAadhaar === userId ||
          (userId === '5432-8765-4321' && (inv.clientId === 'cl-1' || inv.clientEmail === 'alice@client.test')) ||
          (userId === 'cl-1' && (inv.clientId === '5432-8765-4321' || inv.clientAadhaar === '5432-8765-4321'))
        );
        const nameMatch = userName && inv.clientName && inv.clientName.toLowerCase() === userName;
        return idMatch || nameMatch;
      });

      // If a new client has no invoices, automatically generate an initial consultation retainer invoice
      // so they can view their invoice and complete payment testing seamlessly
      if (userInvoices.length === 0 && userId && userId !== 'cl-1' && userId !== '5432-8765-4321') {
        const starterInv = {
          id: `INV-${Math.floor(1000 + Math.random() * 9000)}N`,
          clientId: userId,
          clientName: headers['x-user-name'] || 'Client',
          clientEmail: '',
          clientAadhaar: userId.length === 14 ? userId : '',
          firmId: 'firm-1',
          caseName: 'Initial Consultation Retainer',
          advocateName: 'Adv. Lawyer Bob',
          amount: 1500,
          status: 'Pending',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
        };
        list.unshift(starterInv);
        this._write('lexflow_invoices', list);
        userInvoices = [starterInv];
      }

      return userInvoices;
    }

    if (r === 'lawyer') {
      if (!userName) return list;
      return list.filter((inv) => inv.advocateName && inv.advocateName.toLowerCase().includes(userName));
    }

    if (r === 'firmadmin') {
      const firmId = headers['x-firm-id'] || 'firm-1';
      return list.filter((inv) => !inv.firmId || inv.firmId === firmId);
    }

    // superadmin: all invoices
    return list;
  }

  getInvoice(id) {
    const list = this._read('lexflow_invoices', INITIAL_INVOICES);
    const cleanId = String(id || '').trim().toUpperCase();
    return list.find((i) => String(i.id).toUpperCase() === cleanId) || null;
  }

  createInvoice(body = {}) {
    const list = this._read('lexflow_invoices', INITIAL_INVOICES);
    const newInvoice = {
      id: `INV-${Math.floor(1000 + Math.random() * 9000)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      ...body,
      amount: Number(body.amount || 0),
    };
    list.unshift(newInvoice);
    this._write('lexflow_invoices', list);
    return newInvoice;
  }

  updateInvoice(id, updates = {}) {
    const list = this._read('lexflow_invoices', INITIAL_INVOICES);
    const cleanId = String(id || '').trim().toUpperCase();
    const index = list.findIndex((i) => String(i.id).toUpperCase() === cleanId);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates };
      this._write('lexflow_invoices', list);
      return list[index];
    }
    return null;
  }

  deleteInvoice(id) {
    const list = this._read('lexflow_invoices', INITIAL_INVOICES);
    const cleanId = String(id || '').trim().toUpperCase();
    const filtered = list.filter((i) => String(i.id).toUpperCase() !== cleanId);
    this._write('lexflow_invoices', filtered);
    return { success: true };
  }

  getPayments(role = 'client', headers = {}) {
    const list = this._read('lexflow_payments', INITIAL_PAYMENTS);
    const userId = (headers['x-user-id'] || '').trim();
    const userName = (headers['x-user-name'] || '').trim().toLowerCase();
    const r = (role || '').toLowerCase();

    if (r === 'client') {
      if (!userId && !userName) return list;
      return list.filter((p) => {
        const idMatch = userId && (
          p.clientId === userId ||
          p.clientAadhaar === userId ||
          (userId === '5432-8765-4321' && (p.clientId === 'cl-1' || p.clientName === 'Alice Client')) ||
          (userId === 'cl-1' && (p.clientId === '5432-8765-4321' || p.clientAadhaar === '5432-8765-4321'))
        );
        const nameMatch = userName && p.clientName && p.clientName.toLowerCase() === userName;
        return idMatch || nameMatch;
      });
    }

    if (r === 'firmadmin') {
      const firmId = headers['x-firm-id'] || 'firm-1';
      return list.filter((p) => !p.firmId || p.firmId === firmId);
    }

    return list;
  }

  recordPayment(invoiceId, paymentMethod = 'Card', role = 'client', headers = {}) {
    const invoices = this._read('lexflow_invoices', INITIAL_INVOICES);
    const payments = this._read('lexflow_payments', INITIAL_PAYMENTS);

    const cleanId = String(invoiceId || '').trim().toUpperCase();
    const invIndex = invoices.findIndex((i) => String(i.id).toUpperCase() === cleanId);
    let inv = invIndex !== -1 ? invoices[invIndex] : null;

    if (inv) {
      inv = { ...inv, status: 'Paid', updatedAt: new Date().toISOString() };
      invoices[invIndex] = inv;
      this._write('lexflow_invoices', invoices);
    }

    const newPayment = {
      id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceId: inv ? inv.id : invoiceId,
      clientId: inv?.clientId || headers['x-user-id'] || 'cl-draft-1',
      clientName: inv?.clientName || headers['x-user-name'] || 'Client',
      clientAadhaar: inv?.clientAadhaar || (headers['x-user-id'] && headers['x-user-id'].length === 14 ? headers['x-user-id'] : ''),
      firmId: inv?.firmId || 'firm-1',
      amount: inv ? inv.amount : 1500,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: paymentMethod || 'Card',
      status: 'Completed',
    };

    payments.unshift(newPayment);
    this._write('lexflow_payments', payments);
    return newPayment;
  }

  getClients() {
    return this.getUsers({ role: 'client' }).map((u) => ({
      id: u.id,
      fullName: u.fullName || u.name,
      email: u.email || '',
      aadhaar: u.aadhaar || '',
    }));
  }
}

export const mockStore = new MockStore();
