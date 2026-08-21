const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');

const SUPABASE_URL = "https://ixvzczhhopwucuiwzwpv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Qkp8hQXFR6WZVFgd78_SnA_R5hsoez2";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function genId() {
  return crypto.randomUUID();
}

async function run() {
  console.log('Reading CSV...');
  const csvText = fs.readFileSync('./Managerial Hierarchy.csv', 'utf8');
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const rows = lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ? values[i].trim() : '';
    });
    return obj;
  }).filter(r => r.EmployeeID);

  console.log(`Found ${rows.length} managers in CSV.`);

  // 1. Fetch existing managers to map usernames to IDs
  const { data: existingManagers, error: fetchErr } = await supabase
    .from('managers')
    .select('*');
    
  if (fetchErr) {
    console.error('Error fetching managers:', fetchErr);
    return;
  }

  const managerMap = {}; // username (EmployeeID) -> manager record
  existingManagers.forEach(m => {
    managerMap[m.username.toUpperCase()] = m;
  });

  // 2. Prepare UPSERT payload for all managers
  // We need to resolve `reports_to` to actual manager UUIDs/IDs
  
  // First pass: Ensure all managers have an ID assigned
  const allUpserts = [];
  rows.forEach(r => {
    const username = r.EmployeeID.toUpperCase();
    let id;
    if (managerMap[username]) {
      id = managerMap[username].id;
    } else {
      id = genId(); // Create new ID
      // Add to map so others can reference it
      managerMap[username] = { id, username, name: r.Name };
    }
  });

  // Second pass: Build actual upsert rows with relationships
  rows.forEach(r => {
    const username = r.EmployeeID.toUpperCase();
    const existing = managerMap[username];
    const reportsToUsername = r.ManagerID && r.ManagerID !== 'None' ? r.ManagerID.toUpperCase() : null;
    let reportsToId = null;
    
    if (reportsToUsername && managerMap[reportsToUsername]) {
      reportsToId = managerMap[reportsToUsername].id;
    }

    allUpserts.push({
      id: existing.id,
      name: r.Name,
      username: username,
      password: username, // Default password = EmployeeID
      email: `${username.toLowerCase()}@adonislabs.com`, // Default email
      created_at: existing.created_at || new Date().toISOString(),
      designation: r.Designation || 'ASM',
      reports_to: reportsToId,
      hq: r.HQ || null,
      state: r.State || null
    });
  });

  console.log('Upserting managers...');
  
  // Upsert in batches or all at once
  const { error: upsertErr } = await supabase
    .from('managers')
    .upsert(allUpserts);

  if (upsertErr) {
    console.error('Error upserting managers:', upsertErr);
    
    // Check if the error is due to missing columns
    if (upsertErr.message && upsertErr.message.includes('column')) {
      console.log('\n--- IMPORTANT ---');
      console.log('The database schema needs to be updated before running this script.');
      console.log('Please run the SQL in migration_hierarchy.sql in your Supabase SQL Editor first.');
    }
  } else {
    console.log('Successfully seeded the managerial hierarchy!');
  }
}

run();
