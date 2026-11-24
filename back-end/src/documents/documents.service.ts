import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { loadState, saveState } from '../db';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

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

@Injectable()
export class DocumentsService implements OnModuleInit {
  private documents: Document[] = [];
  private idCounter = 1;

  // Runs once after the DB is ready: use the saved documents if there are any.
  async onModuleInit() {
    this.documents = await loadState('documents', this.documents);
    const ids = this.documents.map((d) => Number(d.id.replace('DOC-', '')) || 0);
    this.idCounter = Math.max(this.idCounter, ...ids.map((n) => n + 1));
  }

  private persist(): void {
    saveState('documents', this.documents);
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
      date: new Date().toLocaleDateString('en-CA'),
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
      date: new Date().toLocaleDateString('en-CA'),
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