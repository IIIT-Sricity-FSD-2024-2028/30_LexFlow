import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/api.js';
import { asList, createResource } from '../resource.js';

export const consultationList = createResource('intake', 'consultations', async ({ role, clientId, firmId }) => {
  if (role === 'client') {
    if (!clientId) throw new Error('Could not determine client ID from session.');
    return { consultations: asList(await api.consultations.getMy(clientId, role)), lawyers: [] };
  }
  const [consultations, lawyers] = await Promise.all([
    api.consultations.getAll(firmId ? { firmId } : {}, role),
    role === 'firmadmin' ? api.users.getLawyers(firmId, role) : [],
  ]);
  return {
    consultations: asList(consultations),
    lawyers: asList(lawyers).filter((user) => user.role?.toLowerCase() === 'lawyer'),
  };
});

export const firmDirectory = createResource('intake', 'directory', async (filters) =>
  asList(await api.lawFirms.getAll(filters, 'client')),
);

export default createSlice({
  name: 'intake',
  initialState: { consultations: null, directory: null },
  reducers: {},
  extraReducers(builder) {
    consultationList.register(builder);
    firmDirectory.register(builder);
  },
}).reducer;
