#!/usr/bin/env tsx
import { initDb, resetDb, closeDb } from './index.js';

console.log('Resetting database...');

try {
  initDb();
  resetDb();
  console.log('Database reset successfully.');
  closeDb();
} catch (error) {
  console.error('Reset failed:', error);
  process.exit(1);
}
