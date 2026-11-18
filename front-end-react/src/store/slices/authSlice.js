import { createSlice } from '@reduxjs/toolkit';
import { getCurrentUser } from '../../api/api.js';

const initialState = {
  user: getCurrentUser(),
  loginRole: localStorage.getItem('loginRole') || '',
};

const authSlice = createSlice({
  name: 'auth',
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
      const normalized = { ...rawUser, role: map[rawUser?.role] || rawUser?.role || '' };
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
  },
});

export const { setUser, setLoginRole, logout, syncUserFromStorage } = authSlice.actions;
export default authSlice.reducer;
