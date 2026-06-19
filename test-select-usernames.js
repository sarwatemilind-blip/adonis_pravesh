const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ixvzczhhopwucuiwzwpv.supabase.co',
  'sb_publishable_Qkp8hQXFR6WZVFgd78_SnA_R5hsoez2' // anon key
);

async function testSelect() {
  const { data, error } = await supabase.from('managers').select('username');
  console.log('Select Error:', error);
  console.log('Usernames in DB:', data.map(d => d.username));
}

testSelect();
