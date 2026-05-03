import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { LawFirmResponseDto } from './dto';
import { UsersService } from '../users/users.service';

// ── Internal model ───────────────────────────────────────────────────────────
interface LawFirm {
  id: string;           // mirrors Firm.id from UsersService  e.g. 'firm-1'
  name: string;
  subtitle: string;
  description: string;
  location: string;        // filter key  e.g. 'mumbai'
  locationLabel: string;   // display label e.g. 'Mumbai, MH'
  practiceArea: string;    // filter key e.g. 'corporate'
  availability: string;    // 'AVAILABLE' | 'TODAY' | 'BUSY'
  rating: number;
  reviews: number;
  price: number;           // per hour in USD
  experience: string;
  bio: string;
  practiceAreas: string[];
  languages: string[];
  education: { school: string; degree: string }[];
  avatarColor: string;
  /** Optional rich contact fields pulled from UsersService Firm record */
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
}

// ── Query filter type ────────────────────────────────────────────────────────
export interface LawFirmFilters {
  keyword?: string;
  location?: string;
  practiceArea?: string;
  /** 'rating' | 'price_asc' | 'reviews' | 'availability' */
  sortBy?: string;
}

@Injectable()
export class LawFirmsService implements OnModuleInit {
  private firms: LawFirm[] = [];

  constructor(private readonly usersService: UsersService) {}

  /** Called by NestJS after all dependencies are resolved */
  onModuleInit(): void {
    this.seedData();
  }

  // ── Seed ──────────────────────────────────────────────────────────────────
  private seedData(): void {
    // ─── Static rich catalogue (generic demo firms) ───────────────────────
    const staticFirms: LawFirm[] = [
      {
        id: 'firm-001',
        name: 'Mehta & Associates',
        subtitle: 'Corporate & IP • Mumbai, MH',
        description:
          'Top tier law firm specializing in high-stakes corporate litigation and tech mergers. Rated as Legal500 Tier 1.',
        location: 'mumbai',
        locationLabel: 'Mumbai, MH',
        practiceArea: 'corporate',
        availability: 'AVAILABLE',
        rating: 4.9,
        reviews: 230,
        price: 200,
        experience: '15+ Years',
        bio: 'Adv. Rajan Mehta is a recognized expert in corporate litigation and intellectual property. With over 15 years representing Fortune 500 companies and high-growth startups, he brings a strategic and results-oriented approach. He specializes in navigating complex regulatory environments and securing multi-million dollar settlements.',
        practiceAreas: ['Corporate Law', 'Intellectual Property', 'Mergers & Acquisitions', 'Commercial Litigation', 'Tech Startups'],
        languages: ['English (Native)', 'Hindi (Fluent)', 'Marathi (Conversational)'],
        education: [
          { school: 'National Law School, Bangalore', degree: 'B.A. LL.B. (Hons), 2008' },
          { school: 'Harvard Law School', degree: 'LL.M. (Corporate), 2010' },
        ],
        avatarColor: 'blue',
      },
      {
        id: 'firm-002',
        name: 'Kapoor Legal Solutions',
        subtitle: 'Family & Divorce • Bangalore, KA',
        description:
          'Compassionate representation for complex family matters, divorce mediation, and custody agreements.',
        location: 'bangalore',
        locationLabel: 'Bangalore, KA',
        practiceArea: 'family',
        availability: 'TODAY',
        rating: 4.8,
        reviews: 184,
        price: 150,
        experience: '10+ Years',
        bio: 'Adv. Priya Kapoor has guided hundreds of families through some of the most challenging moments of their lives. Her empathetic yet assertive approach ensures clients feel heard while achieving the best possible outcome in custody, divorce, and mediation proceedings.',
        practiceAreas: ['Family Law', 'Divorce Mediation', 'Child Custody', 'Matrimonial Property', 'Domestic Disputes'],
        languages: ['English (Fluent)', 'Hindi (Native)', 'Kannada (Conversational)'],
        education: [
          { school: 'Symbiosis Law School, Pune', degree: 'B.A. LL.B., 2013' },
          { school: 'University of Delhi', degree: 'LL.M. (Family Law), 2015' },
        ],
        avatarColor: 'green',
      },
      {
        id: 'firm-003',
        name: 'Rao & Menon Legal',
        subtitle: 'Criminal Defense • Chennai, TN',
        description:
          'Aggressive criminal defense attorneys with a track record of numerous acquittals and reduced sentences.',
        location: 'chennai',
        locationLabel: 'Chennai, TN',
        practiceArea: 'criminal',
        availability: 'BUSY',
        rating: 4.7,
        reviews: 92,
        price: 220,
        experience: '18+ Years',
        bio: 'Senior Partner Adv. Suresh Rao has successfully defended clients in over 400 criminal trials, including high-profile sessions court matters and High Court appeals. Known for meticulous case preparation and fearless courtroom advocacy.',
        practiceAreas: ['Criminal Defense', 'Bail Applications', 'Sessions Court', 'High Court Appeals', 'Cybercrime'],
        languages: ['English (Fluent)', 'Tamil (Native)', 'Telugu (Fluent)'],
        education: [
          { school: 'Dr. Ambedkar Law College, Chennai', degree: 'LL.B., 2005' },
          { school: 'Madras High Court Advocates Academy', degree: 'Advanced Criminal Advocacy, 2007' },
        ],
        avatarColor: 'orange',
      },
      {
        id: 'firm-004',
        name: 'Sharma & Partners',
        subtitle: 'Civil & Property • New Delhi, DL',
        description:
          'Full-service civil law practice handling property disputes, contract enforcement, and consumer protection.',
        location: 'remote',
        locationLabel: 'New Delhi, DL',
        practiceArea: 'civil',
        availability: 'AVAILABLE',
        rating: 4.6,
        reviews: 156,
        price: 175,
        experience: '12+ Years',
        bio: 'Adv. Anjali Sharma leads one of Delhi\'s most respected civil law practices. Her team handles high-value property disputes, tenant-landlord matters, and contract enforcement with surgical precision. Remote consultations available pan-India.',
        practiceAreas: ['Civil Litigation', 'Property Law', 'Contract Disputes', 'Consumer Protection', 'Tenant Rights'],
        languages: ['English (Fluent)', 'Hindi (Native)', 'Punjabi (Conversational)'],
        education: [
          { school: 'Campus Law Centre, Delhi University', degree: 'LL.B., 2011' },
          { school: 'Indian Law Institute', degree: 'LL.M. (Civil Law), 2013' },
        ],
        avatarColor: 'indigo',
      },
      {
        id: 'firm-005',
        name: 'Iyer IP Law',
        subtitle: 'Intellectual Property • Bangalore, KA',
        description:
          'Boutique IP firm specializing in trademark, copyright, patent prosecution and technology licensing.',
        location: 'bangalore',
        locationLabel: 'Bangalore, KA',
        practiceArea: 'ip',
        availability: 'TODAY',
        rating: 4.8,
        reviews: 118,
        price: 250,
        experience: '14+ Years',
        bio: 'Adv. Krishnan Iyer is one of India\'s foremost IP lawyers, having secured trademark registrations and patent grants for over 300 technology companies.',
        practiceAreas: ['Trademark Registration', 'Patent Prosecution', 'Copyright Law', 'Technology Licensing', 'IP Litigation'],
        languages: ['English (Native)', 'Tamil (Fluent)', 'Kannada (Basic)'],
        education: [
          { school: 'NALSAR University of Law', degree: 'B.A. LL.B. (Hons), 2009' },
          { school: 'Queen Mary, University of London', degree: 'LL.M. (IP Law), 2011' },
        ],
        avatarColor: 'purple',
      },
      {
        id: 'firm-006',
        name: 'Khan Immigration Law',
        subtitle: 'Immigration & Visas • Remote Available',
        description:
          'Trusted immigration law firm handling visas, OCI cards, NRI matters, and international relocation.',
        location: 'remote',
        locationLabel: 'Remote Available',
        practiceArea: 'immigration',
        availability: 'AVAILABLE',
        rating: 4.5,
        reviews: 74,
        price: 130,
        experience: '9+ Years',
        bio: 'Adv. Imran Khan has helped over 1,000 individuals and families navigate the complexities of Indian and international immigration law.',
        practiceAreas: ['Visa Applications', 'OCI/PIO Cards', 'NRI Legal Matters', 'Work Permits', 'Citizenship Law'],
        languages: ['English (Fluent)', 'Urdu (Native)', 'Hindi (Fluent)'],
        education: [
          { school: 'Aligarh Muslim University', degree: 'LL.B., 2014' },
          { school: 'George Washington University Law', degree: 'LL.M. (International Law), 2016' },
        ],
        avatarColor: 'teal',
      },
      {
        id: 'firm-007',
        name: 'Nair Corporate Counsel',
        subtitle: 'Corporate & Startup • Mumbai, MH',
        description:
          'Dedicated legal counsel for startups and SMEs — fundraising, equity structuring, and regulatory compliance.',
        location: 'mumbai',
        locationLabel: 'Mumbai, MH',
        practiceArea: 'corporate',
        availability: 'AVAILABLE',
        rating: 4.7,
        reviews: 143,
        price: 190,
        experience: '11+ Years',
        bio: 'Adv. Rajan Nair has been the go-to legal partner for over 80 startups across their entire journey — from incorporation and term sheets to SEBI compliance and exits.',
        practiceAreas: ['Startup Law', 'Fundraising & SAFE/CCPS', 'ESOP Structuring', 'SEBI Compliance', 'Mergers'],
        languages: ['English (Native)', 'Malayalam (Native)', 'Hindi (Fluent)'],
        education: [
          { school: 'Government Law College, Mumbai', degree: 'LL.B., 2012' },
          { school: 'Indian Institute of Management, Ahmedabad', degree: 'MBA (Finance), 2014' },
        ],
        avatarColor: 'pink',
      },
      {
        id: 'firm-008',
        name: 'Das Family Law Centre',
        subtitle: 'Family & Succession • Chennai, TN',
        description:
          'Expert in succession planning, will drafting, probate, and family property partition matters.',
        location: 'chennai',
        locationLabel: 'Chennai, TN',
        practiceArea: 'family',
        availability: 'TODAY',
        rating: 4.6,
        reviews: 88,
        price: 140,
        experience: '13+ Years',
        bio: 'Adv. Meena Das specializes in the intersection of family law and property succession. Her practice helps families navigate will contests, partition suits, and complex multi-generational property disputes.',
        practiceAreas: ['Will Drafting', 'Probate', 'Family Partition', 'Succession Planning', 'Trust Law'],
        languages: ['English (Fluent)', 'Tamil (Native)', 'Bengali (Conversational)'],
        education: [
          { school: 'School of Excellence in Law, Chennai', degree: 'B.A. LL.B. (Hons), 2010' },
          { school: 'University of Madras', degree: 'LL.M. (Family & Succession), 2012' },
        ],
        avatarColor: 'green',
      },
    ];

    // ─── Hydrate real firms from UsersService ─────────────────────────────
    // Pull every firm registered via onboarding and add it to the searchable list.
    // This guarantees firm-1 (Sharma & Associates) always appears in search results.
    const realFirms = this.usersService.getAllFirms();
    const realFirmEntries: LawFirm[] = realFirms.map((f) => ({
      id: f.id,                   // e.g. 'firm-1' — MUST match firmId used in consultations
      name: f.name,               // 'Sharma & Associates'
      subtitle: `Corporate & Civil Law • ${f.city}, ${f.state}`,
      description:
        `${f.name} is a full-service law firm based in ${f.city}, ${f.state}. ` +
        `Offering expert legal counsel across corporate, civil, and litigation matters. ` +
        `Verified and registered on the LexFlow platform.`,
      location: f.city.toLowerCase().replace(/\s+/g, '-'),
      locationLabel: `${f.city}, ${f.state}`,
      practiceArea: 'corporate',
      availability: 'AVAILABLE',
      rating: 4.8,
      reviews: 97,
      price: 180,
      experience: '10+ Years',
      bio:
        `${f.name} is a leading law firm headquartered at ${f.street}, ${f.city}. ` +
        `The firm provides comprehensive legal services to individuals and businesses, ` +
        `covering corporate advisory, dispute resolution, contract law, and compliance. ` +
        `All consultations can be booked directly through the LexFlow platform. ` +
        `Contact: ${f.email || f.primaryEmail || ''} | ${f.phone || ''}`,
      practiceAreas: [
        'Corporate Law', 'Contract Disputes', 'Commercial Litigation',
        'Compliance & Regulatory', 'Civil Law',
      ],
      languages: ['English (Fluent)', 'Hindi (Fluent)'],
      education: [
        { school: 'National Law School of India', degree: 'B.A. LL.B. (Hons)' },
        { school: 'Bar Council of India', degree: 'Enrolled Advocate' },
      ],
      avatarColor: 'indigo',
      email:   f.primaryEmail || f.email,
      phone:   f.phone,
      address: `${f.street}, ${f.city}, ${f.state} - ${f.pinCode}`,
      website: f.website,
    }));

    // Merge: real firms come FIRST (highest relevance), static catalogue follows.
    // Skip any static firm whose id clashes with a real firm id.
    const realIds = new Set(realFirmEntries.map((f) => f.id));
    const deduped = staticFirms.filter((f) => !realIds.has(f.id));

    this.firms = [...realFirmEntries, ...deduped];
  }

  // ── findAll with filter + sort ────────────────────────────────────────────
  findAll(filters: LawFirmFilters): LawFirmResponseDto[] {
    let results = [...this.firms];

    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      results = results.filter(
        (f) =>
          f.name.toLowerCase().includes(kw) ||
          f.subtitle.toLowerCase().includes(kw) ||
          f.description.toLowerCase().includes(kw) ||
          f.bio.toLowerCase().includes(kw) ||
          f.practiceAreas.some((p) => p.toLowerCase().includes(kw)),
      );
    }

    if (filters.location) {
      const loc = filters.location.toLowerCase();
      results = results.filter((f) => f.location === loc);
    }

    if (filters.practiceArea) {
      const pa = filters.practiceArea.toLowerCase();
      results = results.filter((f) => f.practiceArea === pa);
    }

    switch (filters.sortBy) {
      case 'price_asc':
        results.sort((a, b) => a.price - b.price);
        break;
      case 'reviews':
        results.sort((a, b) => b.reviews - a.reviews);
        break;
      case 'availability': {
        const avOrder: Record<string, number> = { AVAILABLE: 0, TODAY: 1, BUSY: 2 };
        results.sort(
          (a, b) => (avOrder[a.availability] ?? 3) - (avOrder[b.availability] ?? 3),
        );
        break;
      }
      case 'rating':
      default:
        results.sort((a, b) => b.rating - a.rating);
        break;
    }

    return results.map(this.toDto);
  }

  // ── findOne ───────────────────────────────────────────────────────────────
  findOne(id: string): LawFirmResponseDto {
    const firm = this.firms.find((f) => f.id === id);
    if (!firm) {
      throw new NotFoundException(`Law firm with ID "${id}" not found`);
    }
    return this.toDto(firm);
  }

  // ── mapper ────────────────────────────────────────────────────────────────
  private toDto(f: LawFirm): LawFirmResponseDto {
    return {
      id:            f.id,
      name:          f.name,
      subtitle:      f.subtitle,
      description:   f.description,
      location:      f.location,
      locationLabel: f.locationLabel,
      practiceArea:  f.practiceArea,
      availability:  f.availability,
      rating:        f.rating,
      reviews:       f.reviews,
      price:         f.price,
      experience:    f.experience,
      bio:           f.bio,
      practiceAreas: f.practiceAreas,
      languages:     f.languages,
      education:     f.education,
      avatarColor:   f.avatarColor,
      email:         f.email,
      phone:         f.phone,
      address:       f.address,
      website:       f.website,
    };
  }
}
