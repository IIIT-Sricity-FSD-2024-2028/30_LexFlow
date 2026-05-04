import { Injectable } from '@nestjs/common';

export interface ActivityEntry {
  id: string;
  date: string;
  user: string;
  email: string;
  role: string;
  firmId: string | null;
  caseId: string;
  action: 'viewed' | 'downloaded' | 'uploaded' | 'updated' | 'deleted';
  docId: string;
  docName: string;
  docType: string;
  access: string;
}

const SEED_ACTIVITY: ActivityEntry[] = [
  {
    id: 'ACT-1001', date: '2026-03-14T09:22:00.000Z',
    user: 'Intern Priya', email: 'priya.intern@lexflow.in', role: 'intern', firmId: 'firm-1',
    caseId: '1', action: 'viewed',
    docId: 'DOC-204', docName: 'Evidence_photo.jpg', docType: 'CASE EVIDENCE', access: 'SHARED',
  },
  {
    id: 'ACT-1002', date: '2026-03-14T10:05:00.000Z',
    user: 'Adv. Mehta', email: 'mehta@lexflow.in', role: 'lawyer', firmId: 'firm-1',
    caseId: '1', action: 'uploaded',
    docId: 'DOC-203', docName: 'Propery Agreement.pdf', docType: 'CONTRACT', access: 'PRIVATE',
  },
  {
    id: 'ACT-1003', date: '2026-03-12T14:18:00.000Z',
    user: 'Adv. Mehta', email: 'mehta@lexflow.in', role: 'lawyer', firmId: 'firm-1',
    caseId: '2', action: 'updated',
    docId: 'DOC-207', docName: 'Affidavit signed.pdf', docType: 'AFFIDAVIT', access: 'PRIVATE',
  },
  {
    id: 'ACT-1004', date: '2026-03-10T08:55:00.000Z',
    user: 'Adv. Sharma', email: 'sharma@lexflow.in', role: 'lawyer', firmId: 'firm-1',
    caseId: '2', action: 'downloaded',
    docId: 'DOC-208', docName: 'Survery report.pdf', docType: 'REPORT', access: 'SHARED',
  },
  {
    id: 'ACT-1005', date: '2026-03-08T11:30:00.000Z',
    user: 'Intern Priya', email: 'priya.intern@lexflow.in', role: 'intern', firmId: 'firm-1',
    caseId: '1', action: 'viewed',
    docId: 'DOC-205', docName: 'Court notice.pdf', docType: 'COURT ORDER', access: 'SHARED',
  },
  {
    id: 'ACT-1006', date: '2026-03-07T16:44:00.000Z',
    user: 'Adv. Mehta', email: 'mehta@lexflow.in', role: 'lawyer', firmId: 'firm-1',
    caseId: '1', action: 'deleted',
    docId: 'DOC-201', docName: 'Old_Petition.pdf', docType: 'CONTRACT', access: 'PRIVATE',
  },
  {
    id: 'ACT-1007', date: '2026-03-06T09:12:00.000Z',
    user: 'Intern Priya', email: 'priya.intern@lexflow.in', role: 'intern', firmId: 'firm-1',
    caseId: '3', action: 'downloaded',
    docId: 'DOC-210', docName: 'Land registry.pdf', docType: 'CONTRACT', access: 'SHARED',
  },
  {
    id: 'ACT-1008', date: '2026-03-05T13:22:00.000Z',
    user: 'Adv. Mehta', email: 'mehta@lexflow.in', role: 'lawyer', firmId: 'firm-1',
    caseId: '3', action: 'uploaded',
    docId: 'DOC-209', docName: 'Witness_Statement.pdf', docType: 'CASE EVIDENCE', access: 'PRIVATE',
  },
  {
    id: 'ACT-1009', date: '2026-03-04T10:00:00.000Z',
    user: 'Firm Admin', email: 'firmadmin@lexflow.test', role: 'firmadmin', firmId: 'firm-1',
    caseId: '1', action: 'viewed',
    docId: 'DOC-206', docName: 'Client ID.jpg', docType: 'CLIENT PROOF', access: 'PRIVATE',
  },
  {
    id: 'ACT-1010', date: '2026-03-01T15:05:00.000Z',
    user: 'Adv. Sharma', email: 'sharma@lexflow.in', role: 'lawyer', firmId: 'firm-1',
    caseId: '1', action: 'updated',
    docId: 'DOC-205', docName: 'Court notice.pdf', docType: 'COURT ORDER', access: 'SHARED',
  },
];

@Injectable()
export class ActivityLogService {
  private log: ActivityEntry[] = [...SEED_ACTIVITY];
  private counter = 1011;

  findAll(caseId?: string): ActivityEntry[] {
    const entries = caseId
      ? this.log.filter(e => e.caseId === caseId)
      : [...this.log];
    return entries.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  create(dto: Omit<ActivityEntry, 'id' | 'date'>): ActivityEntry {
    const entry: ActivityEntry = {
      ...dto,
      id: `ACT-${this.counter++}`,
      date: new Date().toISOString(),
    };
    this.log.unshift(entry);
    if (this.log.length > 500) this.log = this.log.slice(0, 500);
    return entry;
  }
}