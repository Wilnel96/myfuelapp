const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Found ${files.length} migration files to apply`);

let successCount = 0;
let failureCount = 0;

for (const file of files) {
  try {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    console.log(`\nApplying: ${file}...`);

    // Create a temporary file with the migration content
    const tempFile = path.join(__dirname, 'temp_migration.sql');
    fs.writeFileSync(tempFile, content);

    // Apply migration using supabase CLI or direct SQL execution
    // Note: This requires the Supabase CLI to be installed
    try {
      execSync(`npx supabase db push --db-url "${process.env.VITE_SUPABASE_URL}" --file "${tempFile}"`, {
        stdio: 'inherit',
        cwd: __dirname
      });
      console.log(`✓ Successfully applied: ${file}`);
      successCount++;
    } catch (err) {
      console.error(`✗ Failed to apply: ${file}`);
      console.error(err.message);
      failureCount++;
    }

    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

  } catch (error) {
    console.error(`✗ Error reading ${file}:`, error.message);
    failureCount++;
  }
}

console.log(`\n========================================`);
console.log(`Migration Summary:`);
console.log(`  Success: ${successCount}`);
console.log(`  Failures: ${failureCount}`);
console.log(`========================================`);
