import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file
const envFile = readFileSync(join(__dirname, '.env'), 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

async function checkCardPin() {
  console.log('Checking payment cards for PIN...\n');

  const { data: cards, error } = await supabase
    .from('organization_payment_cards')
    .select('id, organization_id, card_brand, last_four_digits, pin_encrypted, iv_pin, is_active, is_default');

  if (error) {
    console.error('Error fetching cards:', error);
    return;
  }

  if (!cards || cards.length === 0) {
    console.log('No payment cards found in the database.');
    return;
  }

  console.log(`Found ${cards.length} payment card(s):\n`);

  cards.forEach((card, index) => {
    console.log(`Card ${index + 1}:`);
    console.log(`  ID: ${card.id}`);
    console.log(`  Organization ID: ${card.organization_id}`);
    console.log(`  Brand: ${card.card_brand}`);
    console.log(`  Last 4 Digits: ${card.last_four_digits}`);
    console.log(`  Has PIN: ${card.pin_encrypted ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  Has IV for PIN: ${card.iv_pin ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  Active: ${card.is_active ? 'YES' : 'NO'}`);
    console.log(`  Default: ${card.is_default ? 'YES' : 'NO'}`);
    console.log('');
  });

  const cardsWithoutPin = cards.filter(c => !c.pin_encrypted);
  if (cardsWithoutPin.length > 0) {
    console.log(`⚠️  WARNING: ${cardsWithoutPin.length} card(s) do not have a PIN encrypted.`);
    console.log('   These cards need to be re-registered with a PIN for NFC payments to work properly.');
  }
}

checkCardPin().catch(console.error);
