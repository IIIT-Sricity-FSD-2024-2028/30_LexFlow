import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { loadState, parseActorId, q, saveState } from '../db';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { Case } from './interfaces/case.interface';

@Injectable()
export class CasesService implements OnModuleInit {
  private cases: Case[] = [];
  private idCounter = 1;

  // Runs once after the DB is ready: use the saved cases if there are any.
  async onModuleInit() {
    this.cases = await loadState('cases', this.cases);
    await this.normalizeClientIds(this.cases);
    this.idCounter = Math.max(0, ...this.cases.map((c) => c.id)) + 1;
  }

  private async normalizeClientIds(records: Pick<Case, 'client_id'>[]) {
    const emails = records.map(({ client_id }) => client_id?.trim().toLowerCase())
      .filter((email): email is string => !!email?.includes('@'));
    if (!emails.length) return;

    // Older consultations used an email as the client reference.
    const { rows } = await q<{ id: number; email: string }>(
      `SELECT min(id) AS id, lower(trim(email_address)) AS email
       FROM clients WHERE lower(trim(email_address)) = ANY($1::text[])
       GROUP BY lower(trim(email_address)) HAVING count(*) = 1`,
      [[...new Set(emails)]],
    );
    const ids = new Map(rows.map(({ id, email }) => [email, `cl-${id}`]));
    for (const record of records) {
      const clientId = ids.get(record.client_id?.trim().toLowerCase() ?? '');
      if (clientId) record.client_id = clientId;
    }
  }

  private async requireClientId(reference?: string): Promise<string> {
    const record = { client_id: reference };
    await this.normalizeClientIds([record]);
    const client = parseActorId(record.client_id ?? '');
    if (client?.kind === 'cl' && client.num > 0 && client.num <= 2147483647) {
      const { rows } = await q('SELECT id FROM clients WHERE id = $1', [client.num]);
      if (rows.length) return `cl-${client.num}`;
    }
    throw new BadRequestException('Select a registered client for this case.');
  }

  getFirmClientIds(firmId: string): number[] {
    const ids = this.findAll({ firmId }).flatMap(({ client_id }) => {
      const parsed = parseActorId(client_id ?? '');
      return parsed?.kind === 'cl' ? [parsed.num] : [];
    });
    return [...new Set(ids)];
  }

  /** Can this logged-in user see this case? (same rules as the React page) */
  canSee(user: any, c: Case): boolean {
    if (user.role === 'superadmin') return true;
    if (user.role === 'client') return c.client_id === user.id;
    if (user.role === 'lawyer' && c.lawyer_id === user.id) return true;
    return c.lawfirm_id === user.firmId; // firmadmin / lawyer / intern
  }

  async create(createCaseDto: CreateCaseDto): Promise<Case> {
    const clientId = await this.requireClientId(createCaseDto.client_id);
    const newCase: Case = {
      id: this.idCounter++,
      ...createCaseDto,
      client_id: clientId,
      created_at: new Date().toISOString(),
      status: createCaseDto.status || 'Active',
    };
    this.cases.push(newCase);
    saveState('cases', this.cases);
    return newCase;
  }

  findAll(filters: {
    firmId?: string;
    clientId?: string;
    lawyerId?: string;
  }): Case[] {
    let filteredCases = [...this.cases];

    if (filters.firmId) {
      filteredCases = filteredCases.filter(c => c.lawfirm_id === filters.firmId);
    }
    if (filters.clientId) {
      filteredCases = filteredCases.filter(c => c.client_id === filters.clientId);
    }
    if (filters.lawyerId) {
      filteredCases = filteredCases.filter(c => c.lawyer_id === filters.lawyerId);
    }

    return filteredCases;
  }

  findOne(id: any): Case {
    const numericId = Number(id);
    const found = this.cases.find(c => Number(c.id) === numericId);
    if (!found) throw new NotFoundException(`Case with ID ${id} not found`);
    return found;
  }

  async update(id: any, updateCaseDto: UpdateCaseDto): Promise<Case> {
    const existing = this.findOne(id);
    const { client_id: requestedClientId, ...changes } = updateCaseDto;
    const clientId = await this.requireClientId(
      requestedClientId === undefined ? existing.client_id : requestedClientId,
    );

    const current = this.findOne(id);
    const caseIndex = this.cases.indexOf(current);
    this.cases[caseIndex] = {
      ...current,
      ...changes,
      // Keep a client reassignment that happened while an unrelated edit was validating.
      client_id: requestedClientId === undefined && current.client_id !== existing.client_id
        ? current.client_id
        : clientId,
    };
    saveState('cases', this.cases);
    return this.cases[caseIndex];
  }

  remove(id: any): void {
    const numericId = Number(id);
    const caseIndex = this.cases.findIndex(c => Number(c.id) === numericId);
    if (caseIndex === -1) throw new NotFoundException(`Case with ID ${id} not found`);
    this.cases.splice(caseIndex, 1);
    saveState('cases', this.cases);
  }
}
