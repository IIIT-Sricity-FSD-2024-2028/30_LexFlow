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
    // ─── Hydrate real firms from UsersService ─────────────────────────────
    // Pull every firm registered via onboarding and add it to the searchable list.
    // This guarantees firm-1 (Sharma & Associates) always appears in search results.
    const realFirms = this.usersService.getAllFirms();

    // Normalise a firm's practiceArea into the filter key used by the client
    // search dropdown ('corporate' | 'family' | 'ip' | 'criminal' | ...).
    const toFilterKey = (pa?: string): string => {
      const v = (pa || '').toLowerCase().trim();
      if (v === 'intellectual property') return 'ip';
      return v;
    };

    // Display tags per practice-area key, so each firm advertises its own
    // specialty instead of a shared hardcoded list.
    const PRACTICE_AREA_TAGS: Record<string, string[]> = {
      corporate:  ['Corporate Law', 'Commercial Litigation', 'Contract Disputes', 'Compliance & Regulatory'],
      family:     ['Family Law', 'Divorce & Custody', 'Succession & Inheritance'],
      ip:         ['Intellectual Property', 'Patent Filings', 'Trademark Disputes', 'Technology Transfer'],
      criminal:   ['Criminal Law', 'Criminal Defense', 'Bail & Trial Matters'],
      civil:      ['Civil Law', 'Property Disputes', 'Litigation'],
      technology: ['Technology Law', 'IT & Startup Advisory', 'SaaS Agreements', 'Data Privacy'],
      cyber:      ['Cyber Law', 'Cybercrime Defense', 'Digital Forensics', 'Data Breach Response'],
      immigration:['Immigration Law', 'Visa & Citizenship Matters'],
    };

    const realFirmEntries: LawFirm[] = realFirms.map((f) => {
      const paKey = toFilterKey(f.practiceArea) || 'civil';
      return {
        id: f.id,                   // e.g. 'firm-1' — MUST match firmId used in consultations
        name: f.name,               // 'Sharma & Associates'
        subtitle: f.subtitle || `Legal Services • ${f.city}, ${f.state}`,
        description:
          f.description ||
          `${f.name} is a law firm based in ${f.city}, ${f.state}. ` +
          `Verified and registered on the LexFlow platform.`,
        location: (f.location || f.city.toLowerCase().replace(/\s+/g, '-')).toLowerCase(),
        locationLabel: `${f.city}, ${f.state}`,
        practiceArea: paKey,
        availability: (f.availability || 'Available').toUpperCase(),
        rating: f.rating ?? 4.5,
        reviews: f.reviews ?? 0,
        price: f.price ?? 200,
        experience: f.experience || '10+ Years',
        bio:
          f.bio ||
          `${f.name} is a law firm headquartered at ${f.street}, ${f.city}. ` +
          `All consultations can be booked directly through the LexFlow platform. ` +
          `Contact: ${f.email || f.primaryEmail || ''} | ${f.phone || ''}`,
        practiceAreas: PRACTICE_AREA_TAGS[paKey] || [f.practiceArea || 'Civil Law'],
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
      };
    });

    this.firms = realFirmEntries;
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
