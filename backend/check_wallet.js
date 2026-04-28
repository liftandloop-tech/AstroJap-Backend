require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("Checking wallet transactions...");
  const { data, error } = await supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) console.error("Error:", error);
  else console.log(data);
}
check();
