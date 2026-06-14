require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });
  await client.connect();
  await client.query(
    "delete from notifications where message like 'E2E-%' or message like 'SMOKE TEST%'",
  );
  await client.query(
    "delete from assignments where title like 'E2E-%' or title like 'SMOKE TEST%'",
  );
  const remaining = await client.query(
    "select count(1)::int as count from assignments where title like 'E2E-%' or title like 'SMOKE TEST%'",
  );
  console.log(`remaining test assignments=${remaining.rows[0].count}`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
