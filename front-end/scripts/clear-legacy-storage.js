// AGGRESSIVE CLEANUP: Run this in the console to remove all non-essential localStorage
const keysToKeep = ['currentUser', 'userRole', 'users', 'loginRole'];

const allKeys = Object.keys(localStorage);
allKeys.forEach(key => {
  if (!keysToKeep.includes(key)) {
    localStorage.removeItem(key);
    console.log(`🗑️ Removed: ${key}`);
  }
});

console.log('✅ LocalStorage cleaned. Only auth-related keys were kept.');
