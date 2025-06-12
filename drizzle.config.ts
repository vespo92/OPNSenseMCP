import type { Config } from 'drizzle-kit';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export default {
  schema: './src/db/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'mcp_user',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DB || 'opnsense_mcp',
  },
  verbose: true,
  strict: true,
} satisfies Config;
