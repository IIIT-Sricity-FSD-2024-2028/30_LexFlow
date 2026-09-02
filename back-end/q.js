// Usage: node q.js "SELECT * FROM lawfirm_meta"
// Reads DATABASE_URL from .env (same loader the app uses).
const { pool, q } = require('./dist/db.js');

q(process.argv[2]).then((r) => {
  console.table(r.rows);
  return pool.end();
}).catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
