import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/api.js';
import { asList, createResource } from '../resource.js';

export const caseDocuments = createResource('documents', 'caseFiles', async ({
  caseId, role, id, firmId, email, hasGrant,
}) => {
  let record;
  try {
    record = await api.cases.getById(caseId, role);
  } catch {
    throw new Error('CASE_NOT_FOUND');
  }
  if (!record) throw new Error('CASE_NOT_FOUND');

  const isOwner = String(record.client_id ?? record.clientId) === String(id);
  const isFirmStaff = ['firmadmin', 'lawyer', 'intern'].includes(role)
    && String(record.lawfirm_id ?? record.firmId) === String(firmId);
  const isAssigned = String(record.lawyer_id ?? record.lawyerId) === String(id);
  if (role !== 'superadmin' && !isOwner && !isFirmStaff && !isAssigned && !hasGrant) {
    throw new Error('NO_DOC_ACCESS');
  }

  const [files, activity, client, lawyer, firms] = await Promise.all([
    api.documents.listByCase(caseId, role, email).catch(() => []),
    api.documents.getActivity(caseId, role, email).catch(() => []),
    record.client_id ? api.users.getById(record.client_id, role).catch(() => null) : null,
    record.lawyer_id ? api.users.getById(record.lawyer_id, role).catch(() => null) : null,
    api.users.getAllFirms(role).catch(() => []),
  ]);
  return {
    files: asList(files),
    activity: asList(activity),
    caseData: {
      ...record,
      clientName: client?.fullName || client?.name,
      lawyerName: lawyer?.fullName || lawyer?.name,
      firmName: asList(firms).find((firm) => firm.id === record.lawfirm_id)?.name,
    },
  };
});

const documents = createSlice({
  name: 'documents',
  initialState: { caseFiles: null },
  reducers: {
    documentSaved(state, { payload: { key, document } }) {
      const entry = state.caseFiles;
      if (entry?.key !== key || !entry.data) return;
      const previous = entry.data.files.find((file) => file.id === document.id);
      if (previous) Object.assign(previous, document);
      else entry.data.files.push(document);
    },
    documentRemoved(state, { payload: { key, id } }) {
      const entry = state.caseFiles;
      if (entry?.key === key && entry.data) {
        entry.data.files = entry.data.files.filter((file) => file.id !== id);
      }
    },
  },
  extraReducers(builder) {
    caseDocuments.register(builder);
  },
});

export const { documentSaved, documentRemoved } = documents.actions;
export default documents.reducer;
