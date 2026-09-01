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
    this.syncFirmsFromUsers();
  }

  private syncFirmsFromUsers(): void {
    // Pull the latest firm's records from UsersService every time so newly created firms
    // are immediately visible to the law-firms search/list APIs without restarting the app.
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

    this.firms = realFirmEntries;
  }

  // ── findAll with filter + sort ────────────────────────────────────────────
  findAll(filters: LawFirmFilters): LawFirmResponseDto[] {
    this.syncFirmsFromUsers();
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
    this.syncFirmsFromUsers();
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
