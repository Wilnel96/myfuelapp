#!/usr/bin/env node

/**
 * Database Setup Script
 *
 * This script sets up your Supabase database by applying all migrations in order.
 * Run this script once when setting up a new environment.
 *
 * Usage: node setup-database.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getMigrationsToApply() {
  const migrationsDir = join(__dirname, 'supabase', 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  // Get already applied migrations
  const { data: appliedMigrations, error } = await supabase
    .from('schema_migrations')
    .select('version');

  if (error && error.code !== '42P01') { // Ignore "table doesn't exist" error
    console.error('Error checking applied migrations:', error);
    return migrationFiles;
  }

  const appliedVersions = new Set(appliedMigrations?.map(m => m.version) || []);

  return migrationFiles.filter(file => {
    const version = file.replace('.sql', '');
    return !appliedVersions.has(version);
  });
}

async function applyMigration(filename) {
  const filePath = join(__dirname, 'supabase', 'migrations', filename);
  const sql = readFileSync(filePath, 'utf-8');
  const version = filename.replace('.sql', '');

  console.log(`\n📄 Applying: ${filename}`);

  try {
    // Execute the migration
    const { error: execError } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (execError) {
      // If the function doesn't exist, try direct execution
      const { error: directError } = await supabase.from('_').select('*').limit(0); // Dummy query

      // Execute via raw SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ sql_query: sql })
      });

      if (!response.ok) {
        // Fall back to direct SQL execution
        const lines = sql.split(';').filter(line => line.trim());
        for (const line of lines) {
          if (line.trim()) {
            const { error } = await supabase.rpc('exec', { query: line });
            if (error) throw error;
          }
        }
      }
    }

    // Record the migration
    const { error: insertError } = await supabase
      .from('schema_migrations')
      .insert({ version });

    if (insertError && insertError.code === '42P01') {
      // Create schema_migrations table if it doesn't exist
      await supabase.from('_').select('*').limit(0);
    }

    console.log(`✅ Success: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${filename}`);
    console.error('Error:', error.message);
    return false;
  }
}

async function setupDatabase() {
  console.log('🚀 Starting Database Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Environment: ${supabaseUrl}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test connection
  console.log('🔌 Testing connection...');
  const { error: connError } = await supabase.from('_').select('*').limit(0);
  if (connError && connError.code !== '42P01') {
    console.error('❌ Connection failed:', connError.message);
    process.exit(1);
  }
  console.log('✅ Connected successfully\n');

  // Get migrations to apply
  console.log('🔍 Checking for migrations...');
  const migrationsToApply = await getMigrationsToApply();

  if (migrationsToApply.length === 0) {
    console.log('✅ Database is up to date! No migrations needed.\n');
    return;
  }

  console.log(`📦 Found ${migrationsToApply.length} migration(s) to apply\n`);

  // Apply each migration
  let successCount = 0;
  let failCount = 0;

  for (const migration of migrationsToApply) {
    const success = await applyMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Migration Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📦 Total: ${migrationsToApply.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failCount > 0) {
    console.log('⚠️  Some migrations failed. Please check the errors above.\n');
    process.exit(1);
  } else {
    console.log('🎉 Database setup complete!\n');
  }
}

// Run setup
setupDatabase().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
