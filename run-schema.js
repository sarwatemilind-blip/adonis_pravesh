const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres:adonispravesh%402026@db.ixvzczhhopwucuiwzwpv.supabase.co:5432/postgres',
});

async function runSchema() {
  try {
    await client.connect();
    const schema = fs.readFileSync('database_schema.sql', 'utf8');
    await client.query(schema);
    console.log('Schema executed successfully!');
  } catch (err) {
    console.error('Error executing schema:', err);
  } finally {
    await client.end();
  }
}

runSchema();
