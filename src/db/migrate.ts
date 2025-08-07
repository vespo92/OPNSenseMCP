// Database Migration Runner
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.js';

// Environment variables are provided by Claude Desktop/Code or npm scripts

async function runMigrations() {
  console.log('🚀 Starting database migrations...');
  
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'opnsense_mcp',
    user: process.env.POSTGRES_USER || 'mcp_user',
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === 'true',
  });

  try {
    const db = drizzle(pool, { schema });
    
    console.log('📦 Running migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };
