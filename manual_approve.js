require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function approve() {
  const email = 'neerajsenrv@gmail.com'; // From our previous check
  const { data, error } = await supabase
    .from('astrologers')
    .update({ approval_status: 'approved', onboarding_step: 5 })
    .eq('email', email)
    .select();

  if (error) console.error('Error:', error);
  else console.log('Successfully Approved:', data);
}
approve();
