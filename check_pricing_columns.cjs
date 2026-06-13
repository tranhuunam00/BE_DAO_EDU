const { Client } = require('pg');

const client = new Client({
  host: '103.90.227.173',
  port: 5435,
  user: 'dao_edu_db_admin',
  password: 'P@ssw0rd_Edu_Dao_2026_Secure!',
  database: 'dao_edu_db',
});

async function main() {
  await client.connect();
  console.log('Connected to DB!');

  const columns = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'course_level_pricing';
  `);
  console.log('Columns in course_level_pricing:');
  console.table(columns.rows);

  await client.end();
}

main().catch(console.error);
