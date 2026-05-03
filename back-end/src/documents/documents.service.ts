import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import * as fs from 'fs';
import * as path from 'path';

export class Document {
  id: string;
  name: string;
  filePath?: string;
  blobUrl?: string;
  caseId: string;
  type: string;
  fileType: string;
  uploader: string;
  uploaderEmail: string;
  date: string;
  version: number;
  access: string;
  iconColor: string;
}

// Seed data — only used if the persistence file doesn't exist yet
const SEED_DOCUMENTS: Document[] = [
  {
    id: 'DOC-203',
    name: 'Propery Agreement.pdf',
    filePath: 'http://localhost:3000/data/docs/Propery Agreement.pdf',
    caseId: 'CASE-45',
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
    caseId: 'CASE-45',
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
    caseId: 'CASE-45',
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
    caseId: 'CASE-45',
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
    caseId: 'CASE-46',
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
    caseId: 'CASE-46',
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
    caseId: 'CASE-47',
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
    caseId: 'CASE-47',
    type: 'CONTRACT',
    fileType: 'PDF',
    uploader: 'Adv. Mehta',
    uploaderEmail: 'mehta@lexflow.in',
    date: '2026-01-15',
    version: 1,
    access: 'SHARED',
    iconColor: 'blue',
  },
];

@Injectable()
export class DocumentsService implements OnModuleInit {
  private documents: Document[] = [];

  // Path to the JSON file that persists documents across restarts
  private readonly dbPath = path.join(
    __dirname,
    '..',
    '..',
    'data',
    'documents.json',
  );

  onModuleInit() {
    this.loadFromDisk();
  }

  /** Load documents from disk, falling back to seed data on first run */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        this.documents = JSON.parse(raw) as Document[];
        console.log(`📂 Loaded ${this.documents.length} documents from ${this.dbPath}`);
      } else {
        this.documents = [...SEED_DOCUMENTS];
        this.saveToDisk(); // write seed data for next time
        console.log(`📂 Seeded ${this.documents.length} documents and saved to disk`);
      }
    } catch (err) {
      console.error('Failed to load documents from disk, using seed data:', err);
      this.documents = [...SEED_DOCUMENTS];
    }
  }

  /** Persist the current documents array to disk */
  private saveToDisk(): void {
    try {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      fs.writeFileSync(this.dbPath, JSON.stringify(this.documents, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save documents to disk:', err);
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
    if (!doc) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
    return doc;
  }

  create(
    createDto: CreateDocumentDto,
    uploaderEmail: string,
    file?: Express.Multer.File,
  ): Document {
    const ids = this.documents
      .map((d) => parseInt(d.id.replace('DOC-', ''), 10))
      .filter((n) => !isNaN(n));
    const nextIdNum = ids.length ? Math.max(...ids) + 1 : 211;
    const newId = `DOC-${nextIdNum}`;

    const newDoc: Document = {
      id: newId,
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
    this.saveToDisk();
    return newDoc;
  }

  update(
    id: string,
    updateDto: UpdateDocumentDto,
    file?: Express.Multer.File,
  ): Document {
    const docIndex = this.documents.findIndex((doc) => doc.id === id);
    if (docIndex === -1) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    const updatedDoc = {
      ...this.documents[docIndex],
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

    this.documents[docIndex] = updatedDoc;
    this.saveToDisk();
    return updatedDoc;
  }

  remove(id: string): void {
    const docIndex = this.documents.findIndex((doc) => doc.id === id);
    if (docIndex === -1) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
    this.documents.splice(docIndex, 1);
    this.saveToDisk();
  }
}
