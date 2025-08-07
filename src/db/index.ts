// Drizzle Configuration and Database Connection
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.js';

// Environment variables are provided by Claude Desktop/Code

// Database configuration interface
export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

// Create database connection pool
export function createDbPool(config?: DatabaseConfig) {
  const poolConfig = {
    host: config?.host || process.env.POSTGRES_HOST || 'localhost',
    port: config?.port || parseInt(process.env.POSTGRES_PORT || '5432'),
    database: config?.database || process.env.POSTGRES_DB || 'opnsense_mcp',
    user: config?.user || process.env.POSTGRES_USER || 'mcp_user',
    password: config?.password || process.env.POSTGRES_PASSWORD,
    ssl: config?.ssl || process.env.POSTGRES_SSL === 'true',
    max: config?.max || 20,
    idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config?.connectionTimeoutMillis || 2000,
  };

  return new Pool(poolConfig);
}

// Create Drizzle ORM instance
export function createDb(pool: any) {
  return drizzle(pool, { schema });
}

// Database instance singleton
let dbInstance: ReturnType<typeof createDb> | null = null;
let poolInstance: any | null = null;

// Get or create database instance
export function getDb(config?: DatabaseConfig) {
  if (!dbInstance || !poolInstance) {
    poolInstance = createDbPool(config);
    dbInstance = createDb(poolInstance);
  }
  return dbInstance;
}

// Close database connections
export async function closeDb() {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}

// Run migrations
export async function runMigrations(db: ReturnType<typeof createDb>) {
  try {
    console.log('Running database migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Export types and utilities
export * from './schema.js';
export type Database = ReturnType<typeof createDb>;
