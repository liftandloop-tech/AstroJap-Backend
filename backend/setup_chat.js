require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setupChat() {
  // 1. Create messages table
  const { error } = await supabase.rpc('execute_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS messages (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('astrologer', 'customer')),
        text TEXT NOT NULL,
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Add free_session toggle to astrologers if it doesn't exist
      ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS is_free_session_active BOOLEAN DEFAULT FALSE;
    `
  });

  if (error) {
    console.error("RPC failed, trying raw insert to test if table exists...");
    // If we can't execute SQL directly, we might not have a way to create the table without migration access.
    // Let's test if the table exists by doing a select.
    const { error: selectErr } = await supabase.from('messages').select('id').limit(1);
    if (selectErr && selectErr.code === '42P01') {
      console.log("Table 'messages' does not exist. We need to create it.");
    } else {
      console.log("Table 'messages' exists or other error:", selectErr);
    }
  } else {
    console.log("SQL executed successfully.");
  }
}

setupChat();
