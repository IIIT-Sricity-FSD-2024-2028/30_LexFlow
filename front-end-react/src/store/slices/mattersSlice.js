import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/api.js';
import { asList, createResource, useResource } from '../resource.js';

export const caseList = createResource('matters', 'cases', async ({ id, firmId, role }) => {
  const filters = role === 'client' && id ? { clientId: id }
    : role === 'lawyer' && id ? { lawyerId: id }
    : firmId ? { firmId } : {};
  return asList(await api.cases.getAll(filters, role));
}, 30_000);

export const taskList = createResource('matters', 'tasks', async ({ firmId, role }) =>
  asList(await api.tasks.getAll({ firmId }, role)),
);

export function useCaseList(user, role) {
  return useResource(caseList, { id: user?.id, firmId: user?.firmId, role });
}

const matters = createSlice({
  name: 'matters',
  initialState: { cases: null, tasks: null },
  reducers: {
    caseSaved(state, { payload }) {
      if (!state.cases?.data) return;
      state.cases.receivedAt = 0;
      const record = state.cases.data.find((item) => String(item.id) === String(payload.id));
      if (record) {
        Object.assign(record, payload);
        // A read started before this save may contain an older version of the case.
        state.cases.status = 'ready';
        state.cases.error = null;
        delete state.cases.requestId;
      }
    },
    casesInvalidated(state) {
      state.cases = null;
    },
  },
  extraReducers(builder) {
    caseList.register(builder);
    taskList.register(builder);
  },
});

export const { caseSaved, casesInvalidated } = matters.actions;
export default matters.reducer;
