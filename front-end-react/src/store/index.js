import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice.js';
import toastReducer from './slices/toastSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    toast: toastReducer,
  },
});

export { useAppDispatch, useAppSelector } from './hooks.js';
export default store;
