import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Test the query
const testQuery = async () => {
  console.log('Testing fuel_transactions query...');
  
  const { data, error } = await supabase
    .from('fuel_transactions')
    .select('transaction_date,fuel_type,gallons')
    .limit(5);
  
  console.log('Data:', data);
  console.log('Error:', error);
};

testQuery();
