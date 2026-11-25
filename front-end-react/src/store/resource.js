import { createAsyncThunk } from '@reduxjs/toolkit';
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

const idle = { status: 'idle', data: undefined, error: null };

// One result per resource. A newer request or a session change supersedes an older response.
export function createResource(slice, field, fetchData, maxAge = 0) {
  const select = (state) => state[slice][field];
  const load = createAsyncThunk(
    `${slice}/load${field[0].toUpperCase()}${field.slice(1)}`,
    async ({ params }, { rejectWithValue }) => {
      try {
        return { data: await fetchData(params), receivedAt: Date.now() };
      } catch (error) {
        return rejectWithValue({ message: error.message, status: error.status ?? null });
      }
    },
    {
      condition: ({ key, force }, { getState }) => {
        const current = select(getState());
        if (force || current?.key !== key) return true;
        return current.status !== 'loading'
          && (current.status !== 'ready' || Date.now() - current.receivedAt >= maxAge);
      },
    },
  );

  return {
    select,
    load,
    register(builder) {
      builder
        .addCase(load.pending, (state, { meta }) => {
          const { key } = meta.arg;
          const current = state[field];
          state[field] = {
            ...idle,
            data: current?.key === key ? current.data : undefined,
            key,
            status: 'loading',
            requestId: meta.requestId,
          };
        })
        .addCase(load.fulfilled, (state, { meta, payload }) => {
          const current = state[field];
          if (current?.requestId !== meta.requestId) return;
          state[field] = { key: current.key, status: 'ready', error: null, ...payload };
        })
        .addCase(load.rejected, (state, { meta, payload, error }) => {
          const current = state[field];
          if (current?.requestId !== meta.requestId) return;
          current.status = 'failed';
          current.error = payload ?? { message: error.message };
          delete current.requestId;
        });
    },
  };
}

export function useResource(resource, params) {
  const dispatch = useDispatch();
  const key = JSON.stringify(params);
  const entry = useSelector((state) => {
    const current = resource.select(state);
    return current?.key === key ? current : idle;
  });
  const load = useCallback((force = false) => dispatch(resource.load({
    key, params: JSON.parse(key), force: force === true,
  })), [dispatch, resource, key]);
  return {
    key, data: entry.data, error: entry.error, load,
    loading: entry.status === 'idle' || entry.status === 'loading',
  };
}

export const asList = (value) => Array.isArray(value) ? value : [];
