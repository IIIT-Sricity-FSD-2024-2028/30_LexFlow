import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import * as fs from 'fs';
import * as path from 'path';

export class Document {
  id: string;
  name: string;
  filePath?: string;
  blobUrl?: string;
  caseId: string;   // matches Case.id (as string: '1', '2', '3')
  type: string;
  fileType: string;
  uploader: string;
  uploaderEmail: string;
  date: string;
  version: number;
  access: string;
  iconColor: string;
}

// Case IDs: 1 = State vs John Doe (Criminal)
//           2 = Sharma vs Gupta (Civil / Property)
//           3 = TechCorp vs SoftSystems (Corporate)
const SEED_DOCUMENTS: Document[] = [
  {
    id: 'DOC-203',
    name: 'Propery Agreement.pdf',
    filePath: 'http://localhost:3000/data/docs/Propery Agreement.pdf',
    caseId: '1',
    type: 'CONTRACT',
    fileType: 'PDF',
    uploader: 'Adv. Mehta',
    uploaderEmail: 'mehta@lexflow.in',
    date: '2026-03-12',
    version: 1,
    access: 'PRIVATE',
    iconColor: 'green',
  },
  {
    id: 'DOC-204',
    name: 'Evidence_photo.jpg',
    filePath: 'http://localhost:3000/data/docs/Evidence_photo.jpg',
    caseId: '1',
    type: 'CASE EVIDENCE',
    fileType: 'IMG',
    uploader: 'Intern Priya',
    uploaderEmail: 'priya.intern@lexflow.in',
    date: '2026-03-14',
    version: 1,
    access: 'SHARED',
    iconColor: 'orange',
  },
  {
    id: 'DOC-205',
    name: 'Court notice.pdf',
    filePath: 'http://localhost:3000/data/docs/Court notice.pdf',
    caseId: '1',
    type: 'COURT ORDER',
    fileType: 'PDF',
    uploader: 'Adv. Mehta',
    uploaderEmail: 'mehta@lexflow.in',
    date: '2026-03-10',
    version: 2,
    access: 'SHARED',
    iconColor: 'green',
  },
  {
    id: 'DOC-206',
    name: 'Client ID.jpg',
    filePath: 'http://localhost:3000/data/docs/Client ID.jpg',
    caseId: '1',
    type: 'CLIENT PROOF',
    fileType: 'IMG',
    uploader: 'Intern Priya',
    uploaderEmail: 'priya.intern@lexflow.in',
    date: '2026-03-08',
    version: 1,
    access: 'PRIVATE',
    iconColor: 'orange',
  },
  {
    id: 'DOC-207',
    name: 'Affidavit signed.pdf',
    filePath: 'http://localhost:3000/data/docs/Affidavit signed.pdf',
    caseId: '2',
    type: 'AFFIDAVIT',
    fileType: 'PDF',
    uploader: 'Adv. Mehta',
    uploaderEmail: 'mehta@lexflow.in',
    date: '2026-02-28',
    version: 1,
    access: 'PRIVATE',
    iconColor: 'green',
  },
  {
    id: 'DOC-208',
    name: 'Survery report.pdf',
    filePath: 'http://localhost:3000/data/docs/Survery report.pdf',
    caseId: '2',
    type: 'REPORT',
    fileType: 'PDF',
    uploader: 'Adv. Sharma',
    uploaderEmail: 'sharma@lexflow.in',
    date: '2026-02-20',
    version: 1,
    access: 'SHARED',
    iconColor: 'blue',
  },
  {
    id: 'DOC-209',
    name: 'Witness_Statement.pdf',
    filePath: 'http://localhost:3000/data/docs/Witness_Statement.pdf',
    caseId: '3',
    type: 'CASE EVIDENCE',
    fileType: 'PDF',
    uploader: 'Intern Rohan',
    uploaderEmail: 'rohan.intern@lexflow.in',
    date: '2026-03-01',
    version: 1,
    access: 'PRIVATE',
    iconColor: 'green',
  },
  {
    id: 'DOC-210',
    name: 'Land registry.pdf',
    filePath: 'http://localhost:3000/data/docs/Land registry.pdf',
    caseId: '3',
    type: 'CONTRACT',
    fileType: 'PDF',
    uploader: 'Adv. Mehta',
    uploaderEmail: 'mehta@lexflow.in',
    date: '2026-01-15',
    version: 1,
    access: 'SHARED',
    iconColor: 'blue',
  },
  {
    id: 'DOC-211',
    name: 'AI_report.pdf',
    filePath: 'http://localhost:3000/data/docs/AI_report-1777806733766-135554284.pdf',
    caseId: '2',
    type: 'REPORT',
    fileType: 'PDF',
    uploader: 'alice',
    uploaderEmail: 'alice@client.test',
    date: '2026-05-03',
    version: 1,
    access: 'PRIVATE',
    iconColor: 'blue',
  },
  {
    id: 'DOC-212',
    name: 'S20240010114.pdf',
    filePath: 'http://localhost:3000/data/docs/S20240010114-1777807089170-949272962.pdf',
    caseId: '2',
    type: 'CLIENT PROOF',
    fileType: 'PDF',
    uploader: 'alice',
    uploaderEmail: 'alice@client.test',
    date: '2026-05-03',
    version: 1,
    access: 'PRIVATE',
    iconColor: 'blue',
  },
  {
    id: 'DOC-213',
    name: 'Sricity report.pdf',
    filePath: 'http://localhost:3000/data/docs/Sricity report-1777808952234-280794985.pdf',
    caseId: '2',
    type: 'LEGAL NOTICE',
    fileType: 'PDF',
    uploader: 'alice',
    uploaderEmail: 'alice@client.test',
    date: '2026-05-03',
    version: 1,
    access: 'PRIVATE',
    iconColor: 'blue',
  },
  {
    id: 'DOC-214',
    name: 'AI_report.pdf',
    filePath: 'http://localhost:3000/data/docs/AI_report-1777813390954-776802151.pdf',
    caseId: '2',
    type: 'REPORT',
    fileType: 'PDF',
    uploader: 'rahulsharma',
    uploaderEmail: 'rahulsharma@example.com',
    date: '2026-05-03',
    version: 1,
    access: 'PRIVATE',
    iconColor: 'blue',
  },
];

const STORE_FILE = path.join(__dirname, '..', '..', 'data', 'documents.json');

@Injectable()
export class DocumentsService {
  private documents: Document[];
  private idCounter = 215; // next DOC id after seed

  constructor() {
    // Survive restarts: hydrate from data/documents.json when present,
    // fall back to seeds on first run.
    this.documents = [...SEED_DOCUMENTS];
    try {
      const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      if (Array.isArray(raw) && raw.length) {
        this.documents = raw;
        const maxId = Math.max(
          0,
          ...raw.map((d: Document) => Number(String(d.id).replace('DOC-', '')) || 0),
        );
        this.idCounter = maxId + 1;
      }
    } catch {
      /* first run — keep seeds */
    }
  }

  private persist(): void {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.documents, null, 2));
    } catch (e) {
      // non-fatal: documents still live in memory for this run
    }
  }

  findAll(caseId?: string): Document[] {
    if (caseId) {
      return this.documents.filter((doc) => doc.caseId === caseId);
    }
    return this.documents;
  }

  findOne(id: string): Document {
    const doc = this.documents.find((doc) => doc.id === id);
    if (!doc) throw new NotFoundException(`Document with ID ${id} not found`);
    return doc;
  }

  create(
    createDto: CreateDocumentDto,
    uploaderEmail: string,
    file?: Express.Multer.File,
  ): Document {
    const newDoc: Document = {
      id: `DOC-${this.idCounter++}`,
      name: createDto.name,
      caseId: createDto.caseId,
      type: createDto.type,
      fileType: createDto.fileType,
      access: createDto.access,
      version: Number(createDto.version) || 1,
      date: new Date().toISOString().split('T')[0],
      uploader: uploaderEmail.split('@')[0],
      uploaderEmail,
      iconColor: 'blue',
      filePath: file
        ? `http://localhost:3000/data/docs/${file.filename}`
        : undefined,
    };
    this.documents.push(newDoc);
    this.persist();
    return newDoc;
  }

  update(
    id: string,
    updateDto: UpdateDocumentDto,
    file?: Express.Multer.File,
  ): Document {
    const idx = this.documents.findIndex((doc) => doc.id === id);
    if (idx === -1) throw new NotFoundException(`Document with ID ${id} not found`);

    const updatedDoc = {
      ...this.documents[idx],
      ...updateDto,
      date: new Date().toISOString().split('T')[0],
    };

    if (file) {
      updatedDoc.filePath = `http://localhost:3000/data/docs/${file.filename}`;
      const ext = file.originalname.split('.').pop();
      if (ext) updatedDoc.fileType = ext.toUpperCase().slice(0, 3);
    }

    if (updateDto.version !== undefined) {
      updatedDoc.version = Number(updateDto.version);
    }

    this.documents[idx] = updatedDoc;
    this.persist();
    return updatedDoc;
  }

  remove(id: string): void {
    const idx = this.documents.findIndex((doc) => doc.id === id);
    if (idx === -1) throw new NotFoundException(`Document with ID ${id} not found`);
    this.documents.splice(idx, 1);
    this.persist();
  }
}