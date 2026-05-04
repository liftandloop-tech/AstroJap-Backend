const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' }); // Adjust path if needed

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function updateConstraint() {
  console.log("Updating database constraint...");
  
  // Note: Supabase JS client doesn't directly support running raw DDL easily unless using RPC
  // But we can try to update the schema files and tell the user.
  // Actually, I'll just check if I can run an RPC or if I should just update the code and SQL.
  
  console.log("Please run the following SQL in your Supabase SQL Editor:");
  console.log(`
    ALTER TABLE astrologers DROP CONSTRAINT IF EXISTS astrologers_approval_status_check;
    ALTER TABLE astrologers ADD CONSTRAINT astrologers_approval_status_check 
    CHECK (approval_status IN ('processing', 'pending', 'approved', 'rejected', 'onboarding'));
  `);
}

updateConstraint();
