import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

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

const STORE_FILE = path.join(__dirname, '..', '..', 'data', 'activity-log.json');

/**
 * No seed data — entries are written only by real user actions
 * (viewed / downloaded / uploaded / updated / deleted, posted by the
 * frontend on each action). Persisted to data/activity-log.json so the
 * log survives server restarts.
 */
@Injectable()
export class ActivityLogService {
  private log: ActivityEntry[] = [];
  private counter = 1;

  constructor() {
    try {
      const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        this.log = raw;
        const maxId = Math.max(0, ...raw.map((e) => Number(String(e.id).replace('ACT-', '')) || 0));
        this.counter = maxId + 1;
      }
    } catch {
      /* first run — empty log */
    }
  }

  private persist(): void {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.log, null, 2));
    } catch {
      /* non-fatal */
    }
  }

  findAll(caseId?: string): ActivityEntry[] {
    const entries = caseId
      ? this.log.filter((e) => e.caseId === caseId)
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
    this.persist();
    return entry;
  }
}
