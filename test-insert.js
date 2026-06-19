const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ixvzczhhopwucuiwzwpv.supabase.co',
  'sb_publishable_Qkp8hQXFR6WZVFgd78_SnA_R5hsoez2' // anon key
);

async function testInsert() {
  const { data, error } = await supabase.from('managers').upsert({
    id: 'e6a8e805-59b3-4613-810a-6e5414d0f7a7',
    name: 'Test Manager',
    username: 'testmgr',
    password: 'password123',
    email: 'test@example.com'
  });
  console.log('Error:', error);
  console.log('Data:', data);
}

testInsert();
