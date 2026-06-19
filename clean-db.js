const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ixvzczhhopwucuiwzwpv.supabase.co',
  'sb_publishable_Qkp8hQXFR6WZVFgd78_SnA_R5hsoez2' // anon key
);

async function cleanDB() {
  const { data, error } = await supabase.from('managers').delete().neq('username', 'testmgr');
  console.log('Delete Error:', error);
  console.log('Deleted rows:', data);
}

cleanDB();
