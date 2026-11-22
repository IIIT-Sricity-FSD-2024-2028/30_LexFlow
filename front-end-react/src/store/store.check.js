import assert from 'node:assert/strict';

// Mock localStorage and sessionStorage for Node.js environment
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
};
global.sessionStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
};
global.document = { cookie: '' };
global.window = { location: { hash: '' } };

async function runTests() {
  console.log('Testing Redux Toolkit Store...');
  const { store, useAppDispatch: indexUseAppDispatch, useAppSelector: indexUseAppSelector } = await import('./index.js');
  const { useAppDispatch, useAppSelector } = await import('./hooks.js');
  const { setUser, setLoginRole, logout, syncUserFromStorage } = await import('./slices/authSlice.js');
  const { addToast, removeToast, clearToasts, showToast } = await import('./slices/toastSlice.js');

  // Verify custom RTK hooks
  assert.equal(typeof useAppDispatch, 'function', 'useAppDispatch must be a function');
  assert.equal(typeof useAppSelector, 'function', 'useAppSelector must be a function');
  assert.equal(useAppDispatch, indexUseAppDispatch, 'useAppDispatch must be exported from index');
  assert.equal(useAppSelector, indexUseAppSelector, 'useAppSelector must be exported from index');
  console.log('✔ Custom RTK hooks (useAppDispatch, useAppSelector) verified');

  // 1. Initial State
  const initial = store.getState();
  assert(initial.auth !== undefined, 'auth slice must exist');
  assert(initial.toast !== undefined, 'toast slice must exist');
  assert.equal(initial.auth.user, null, 'user should initially be null');
  assert.deepEqual(initial.toast.toasts, [], 'toasts should initially be empty');
  console.log('✔ Initial state verified');

  // 2. setUser with role normalization
  store.dispatch(setUser({ id: 'u1', fullName: 'Test User', role: 'firmadmin' }));
  const stateAfterUser = store.getState();
  assert.equal(stateAfterUser.auth.user.fullName, 'Test User');
  assert.equal(stateAfterUser.auth.user.role, 'firmAdmin', 'role should be normalized to firmAdmin');
  assert.equal(localStorage.getItem('userRole'), 'firmAdmin');
  console.log('✔ setUser action and role normalization verified');

  // 3. setLoginRole
  store.dispatch(setLoginRole('client'));
  assert.equal(store.getState().auth.loginRole, 'client');
  assert.equal(localStorage.getItem('loginRole'), 'client');
  console.log('✔ setLoginRole verified');

  // 4. Toast actions
  store.dispatch(addToast({ id: 101, message: 'Case created successfully', type: 'success' }));
  assert.equal(store.getState().toast.toasts.length, 1);
  assert.equal(store.getState().toast.toasts[0].message, 'Case created successfully');

  store.dispatch(addToast({ id: 102, message: 'Payment failed', type: 'error' }));
  assert.equal(store.getState().toast.toasts.length, 2);

  store.dispatch(removeToast(101));
  assert.equal(store.getState().toast.toasts.length, 1);
  assert.equal(store.getState().toast.toasts[0].id, 102);

  store.dispatch(clearToasts());
  assert.equal(store.getState().toast.toasts.length, 0);

  // Thunk showToast test
  store.dispatch(showToast('Thunk Toast', 'success'));
  assert.equal(store.getState().toast.toasts.length, 1);
  assert.equal(store.getState().toast.toasts[0].message, 'Thunk Toast');
  store.dispatch(clearToasts());
  console.log('✔ Toast actions and showToast thunk verified');

  // 5. syncUserFromStorage
  storage['currentUser'] = JSON.stringify({ id: 'u2', fullName: 'Synced User', role: 'superAdmin' });
  store.dispatch(syncUserFromStorage());
  assert.equal(store.getState().auth.user.fullName, 'Synced User');
  console.log('✔ syncUserFromStorage verified');

  // 6. Logout
  store.dispatch(logout());
  assert.equal(store.getState().auth.user, null);
  assert.equal(store.getState().auth.loginRole, '');
  assert.equal(localStorage.getItem('currentUser'), null);
  console.log('✔ Logout action verified');

  console.log('\nAll Redux Toolkit assertions passed successfully! ✔');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
