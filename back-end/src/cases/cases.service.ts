import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { Case } from './interfaces/case.interface';

@Injectable()
export class CasesService {
  private cases: Case[] = [];
  private idCounter = 1;

  constructor() {
    this.seedCases();
  }

  private seedCases() {
    const now = new Date().toISOString();
    this.cases = [
      {
        id: this.idCounter++,
        cnr: '100001',
        case_type: 'Criminal',
        brief_description: 'State vs John Doe - Narcotics case',
        status: 'Active',
        filed_date: '2024-01-15',
        created_at: now,
        lawfirm_id: 'firm-1',
        client_id: 'user-2', // Client Alice
        lawyer_id: 'user-3', // Lawyer Bob
      },
      {
        id: this.idCounter++,
        cnr: '100002',
        case_type: 'Civil',
        brief_description: 'Property dispute - Sharma vs Gupta',
        status: 'Active',
        filed_date: '2024-02-20',
        created_at: now,
        lawfirm_id: 'firm-1',
        client_id: 'user-2', // Client Alice
        lawyer_id: 'user-3', // Lawyer Bob
      },
      {
        id: this.idCounter++,
        cnr: '100003',
        case_type: 'Corporate',
        brief_description: 'Contract breach - TechCorp vs SoftSystems',
        status: 'Pending',
        filed_date: '2024-03-05',
        created_at: now,
        lawfirm_id: 'firm-1',
        client_id: 'user-2', // Client Alice
        lawyer_id: 'user-3', // Lawyer Bob
      },
    ];
  }

  create(createCaseDto: CreateCaseDto): Case {
    const newCase: Case = {
      id: this.idCounter++,
      ...createCaseDto,
      created_at: new Date().toISOString(),
      status: createCaseDto.status || 'Active',
    };
    this.cases.push(newCase);
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

  update(id: any, updateCaseDto: UpdateCaseDto): Case {
    const numericId = Number(id);
    const caseIndex = this.cases.findIndex(c => Number(c.id) === numericId);
    if (caseIndex === -1) throw new NotFoundException(`Case with ID ${id} not found`);

    this.cases[caseIndex] = {
      ...this.cases[caseIndex],
      ...updateCaseDto,
    };
    return this.cases[caseIndex];
  }

  remove(id: any): void {
    const numericId = Number(id);
    const caseIndex = this.cases.findIndex(c => Number(c.id) === numericId);
    if (caseIndex === -1) throw new NotFoundException(`Case with ID ${id} not found`);
    this.cases.splice(caseIndex, 1);
  }
}
