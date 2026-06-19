const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ixvzczhhopwucuiwzwpv.supabase.co',
  'sb_publishable_Qkp8hQXFR6WZVFgd78_SnA_R5hsoez2' // anon key
);

async function testSelectAll() {
  const [mRes, cRes, eRes] = await Promise.all([
    supabase.from('managers').select('*'),
    supabase.from('candidates').select('*'),
    supabase.from('email_log').select('*')
  ]);
  console.log('Managers Error:', mRes.error);
  console.log('Candidates Error:', cRes.error);
  console.log('EmailLog Error:', eRes.error);
}

testSelectAll();
