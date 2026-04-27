require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('astrologers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) console.error('Error:', error);
  else console.log('Latest Astrologer:', JSON.stringify(data, null, 2));
}
check();
