import { combineReducers, configureStore } from '@reduxjs/toolkit';
import app, { logout, setUser, syncUserFromStorage } from './slices/appSlice.js';
import intake from './slices/intakeSlice.js';
import matters from './slices/mattersSlice.js';
import documents from './slices/documentsSlice.js';
import firmManagement from './slices/firmManagementSlice.js';

const reduce = combineReducers({ app, intake, matters, documents, firmManagement });

function sessionKey(user) {
  return JSON.stringify([user?.id, user?.role, user?.firmId]);
}

export const store = configureStore({
  devTools: import.meta.env?.DEV === true,
  reducer(state, action) {
    const next = reduce(state, action);
    const switchedAccount = syncUserFromStorage.match(action)
      && sessionKey(state?.app.user) !== sessionKey(next.app.user);
    if (logout.match(action) || setUser.match(action) || switchedAccount) {
      // Discard private data and any requests belonging to the previous session.
      return reduce({ app: next.app }, { type: 'app/resetFeatureData' });
    }
    return next;
  },
});

export default store;
