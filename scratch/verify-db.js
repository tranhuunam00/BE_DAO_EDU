const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5435', 10),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

async function main() {
  await client.connect();
  try {
    const tableRes = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename NOT IN ('migrations', 'typeorm_metadata')
      ORDER BY tablename
    `);
    
    const tables = tableRes.rows.map(r => r.tablename);
    console.log(`Found ${tables.length} tables to verify:`);
    
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      const count = parseInt(res.rows[0].count, 10);
      if (count > 0) {
        console.log(`-> Table ${table}: ${count} rows (NOT EMPTY)`);
      } else {
        console.log(`   Table ${table}: 0 rows`);
      }
    }
    
    const users = await client.query(`SELECT id, email, name, role_id FROM "users"`);
    console.log('All Users:', users.rows);
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await client.end();
  }
}

main();

