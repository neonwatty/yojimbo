import { initDatabase, closeDatabase } from './connection.js';

console.log('🔄 Running database migrations...');

try {
  initDatabase();
  console.log('✅ Migrations complete');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  closeDatabase();
}
