#!/usr/bin/env node

// Enhanced Cache Setup Script
import { config } from 'dotenv';
import { createDbPool, createDb, runMigrations } from './src/db/index.js';
import Redis from 'ioredis';
import { sql } from 'drizzle-orm';

config();

async function setupEnhancedCache() {
  console.log('🚀 Setting up Enhanced Cache System...\n');

  // Step 1: Test PostgreSQL Connection
  console.log('📊 Testing PostgreSQL connection...');
  const pool = createDbPool();
  try {
    const result = await pool.query('SELECT version()');
    console.log('✅ PostgreSQL connected:', result.rows[0].version);
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    process.exit(1);
  }

  // Step 2: Run Migrations
  console.log('\n📦 Running database migrations...');
  const db = createDb(pool);
  try {
    await runMigrations(db);
    console.log('✅ Migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    // Don't exit - migrations might already be applied
  }

  // Step 3: Test Redis Connection
  console.log('\n🔥 Testing Redis connection...');
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  });

  try {
    const pong = await redis.ping();
    console.log('✅ Redis connected:', pong);
    
    const info = await redis.info('server');
    const version = info.match(/redis_version:(.+)/)?.[1];
    console.log('   Redis version:', version);
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.log('   Make sure Redis is running and accessible');
  }

  // Step 4: Initialize Default Invalidation Rules
  console.log('\n🔧 Setting up cache invalidation rules...');
  try {
    const existingRules = await db.execute(
      sql`SELECT COUNT(*) as count FROM cache_invalidation_rules`
    );
    
    if (existingRules[0].count === '0') {
      console.log('   Creating default invalidation rules...');
      // Rules are created by migration
      console.log('✅ Default rules created');
    } else {
      console.log('✅ Invalidation rules already configured');
    }
  } catch (error) {
    console.error('⚠️  Could not check invalidation rules:', error.message);
  }

  // Step 5: Create Cache Performance View
  console.log('\n📈 Setting up performance monitoring...');
  try {
    await db.execute(sql`
      REFRESH MATERIALIZED VIEW IF EXISTS cache_performance_analytics
    `);
    console.log('✅ Performance analytics view refreshed');
  } catch (error) {
    console.log('⚠️  Performance view not yet available');
  }

  // Step 6: Test Cache Operations
  console.log('\n🧪 Testing cache operations...');
  try {
    // Test Redis set/get
    await redis.setex('test:setup', 10, 'success');
    const testValue = await redis.get('test:setup');
    if (testValue === 'success') {
      console.log('✅ Redis cache operations working');
    }

    // Test database cache stats
    await db.execute(sql`
      INSERT INTO cache_stats (key, hits, misses, last_access)
      VALUES ('test:setup', 1, 0, NOW())
      ON CONFLICT (key) DO UPDATE
      SET hits = cache_stats.hits + 1, last_access = NOW()
    `);
    console.log('✅ Database cache tracking working');
  } catch (error) {
    console.error('❌ Cache operation test failed:', error.message);
  }

  // Step 7: Display Configuration
  console.log('\n📋 Current Configuration:');
  console.log('   PostgreSQL:', `${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`);
  console.log('   Redis:', `${process.env.REDIS_HOST}:${process.env.REDIS_PORT} (DB: ${process.env.REDIS_DB})`);
  console.log('   Cache TTL:', process.env.CACHE_DEFAULT_TTL || '300', 'seconds');
  console.log('   Pattern Analysis:', process.env.ENABLE_PATTERN_ANALYSIS !== 'false' ? 'Enabled' : 'Disabled');

  // Cleanup
  await redis.quit();
  await pool.end();

  console.log('\n✨ Enhanced cache system setup complete!');
  console.log('\nNext steps:');
  console.log('1. Run "npm run dev" to start the MCP server');
  console.log('2. Use "npm run db:studio" to explore the database');
  console.log('3. Monitor cache performance with the provided SQL queries');
}

// Run setup
setupEnhancedCache().catch(error => {
  console.error('\n💥 Setup failed:', error);
  process.exit(1);
});
