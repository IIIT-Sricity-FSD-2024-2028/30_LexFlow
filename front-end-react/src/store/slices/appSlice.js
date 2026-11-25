import { createSlice } from '@reduxjs/toolkit';
import { getCurrentUser } from '../../api/api.js';

// Cache only what the UI needs; PII is fetched from GET /users/:id on demand.
const KEEP = ['id', 'userId', 'clientId', 'fullName', 'name', 'email', 'role', 'firmId', 'firmName', 'caseAccess'];
const minimalUser = (u) => Object.fromEntries(KEEP.filter((k) => u[k] !== undefined).map((k) => [k, u[k]]));

const initialState = {
  user: getCurrentUser(),
  loginRole: localStorage.getItem('loginRole') || '',
  toasts: [],
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setUser(state, action) {
      const rawUser = action.payload;
      if (!rawUser) {
        state.user = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        return;
      }
      const map = { firmadmin: 'firmAdmin', superadmin: 'superAdmin' };
      const normalized = { ...minimalUser(rawUser), role: map[rawUser?.role] || rawUser?.role || '' };
      state.user = normalized;
      localStorage.setItem('currentUser', JSON.stringify(normalized));
      localStorage.setItem('userRole', normalized.role);
      localStorage.removeItem('loginRole');
    },
    setLoginRole(state, action) {
      state.loginRole = action.payload || '';
      if (action.payload) {
        localStorage.setItem('loginRole', action.payload);
      } else {
        localStorage.removeItem('loginRole');
      }
    },
    logout(state) {
      state.user = null;
      state.loginRole = '';
      state.toasts = [];
      localStorage.removeItem('currentUser');
      localStorage.removeItem('access_token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('loginRole');
      sessionStorage.removeItem('clientDraft');
      sessionStorage.removeItem('firmDraft');
    },
    syncUserFromStorage(state) {
      state.user = getCurrentUser();
      state.loginRole = localStorage.getItem('loginRole') || '';
    },
    addToast(state, action) {
      state.toasts.push(action.payload);
    },
    removeToast(state, action) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { setUser, setLoginRole, logout, syncUserFromStorage } = appSlice.actions;

const { addToast, removeToast } = appSlice.actions;
export const showToast = (message, type = 'success') => (dispatch) => {
  const id = Date.now() + Math.random();
  dispatch(addToast({ id, message, type }));
  setTimeout(() => dispatch(removeToast(id)), 3500);
};

export default appSlice.reducer;
