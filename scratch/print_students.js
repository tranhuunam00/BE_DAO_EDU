const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const env = fs.readFileSync('.env', 'utf8');
  const dbPass = env.match(/DATABASE_PASSWORD=(.*)/)[1].trim();
  const dbUser = env.match(/DATABASE_USER=(.*)/)[1].trim();
  const dbHost = env.match(/DATABASE_HOST=(.*)/)[1].trim();
  const dbPort = env.match(/DATABASE_PORT=(.*)/)[1].trim();
  const dbName = env.match(/DATABASE_NAME=(.*)/)[1].trim();
  
  const client = new Client({
    host: dbHost,
    port: parseInt(dbPort, 10),
    user: dbUser,
    password: dbPass,
    database: dbName,
  });

  await client.connect();
  const res = await client.query('SELECT student_id, first_name, last_name FROM students LIMIT 10');
  console.log("Students in DB:", JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
