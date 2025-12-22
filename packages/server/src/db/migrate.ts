#!/usr/bin/env tsx
import { initDb, closeDb } from './index.js';

console.log('Running database migrations...');

try {
  initDb();
  console.log('Migrations completed successfully.');
  closeDb();
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
