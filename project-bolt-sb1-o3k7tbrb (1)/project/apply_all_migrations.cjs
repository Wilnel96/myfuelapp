const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Found ${files.length} migration files`);

// Combine all migrations into one large SQL script
let combinedSQL = '-- Combined migrations\n\n';

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  combinedSQL += `\n\n-- ========================================\n`;
  combinedSQL += `-- Migration: ${file}\n`;
  combinedSQL += `-- ========================================\n\n`;
  combinedSQL += content;
}

// Write combined SQL to a file
const outputFile = path.join(__dirname, 'combined_migrations.sql');
fs.writeFileSync(outputFile, combinedSQL);

console.log(`Combined migrations written to: combined_migrations.sql`);
console.log(`Total size: ${(combinedSQL.length / 1024).toFixed(2)} KB`);
