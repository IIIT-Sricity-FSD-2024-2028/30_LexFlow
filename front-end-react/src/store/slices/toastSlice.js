import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  toasts: [],
};

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    addToast(state, action) {
      state.toasts.push(action.payload);
    },
    removeToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    clearToasts(state) {
      state.toasts = [];
    },
  },
});

export const { addToast, removeToast, clearToasts } = toastSlice.actions;

/**
 * Thunk to show a toast message and automatically dismiss it after 3.5 seconds.
 */
export const showToast = (message, type = 'success') => (dispatch) => {
  const id = Date.now() + Math.random();
  dispatch(addToast({ id, message, type }));
  setTimeout(() => {
    dispatch(removeToast(id));
  }, 3500);
};

export default toastSlice.reducer;
