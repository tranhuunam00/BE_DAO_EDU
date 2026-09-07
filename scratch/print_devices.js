const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5435,
    user: 'dao_edu_db_admin',
    password: 'your_postgres_password_here', // Wait, let's use the actual password from .env!
    database: 'dao_edu_db',
  });
  
  // Read password from env
  const fs = require('fs');
  const env = fs.readFileSync('.env', 'utf8');
  const dbPass = env.match(/DATABASE_PASSWORD=(.*)/)[1].trim();
  const dbUser = env.match(/DATABASE_USER=(.*)/)[1].trim();
  const dbHost = env.match(/DATABASE_HOST=(.*)/)[1].trim();
  const dbPort = env.match(/DATABASE_PORT=(.*)/)[1].trim();
  const dbName = env.match(/DATABASE_NAME=(.*)/)[1].trim();
  
  const client2 = new Client({
    host: dbHost,
    port: parseInt(dbPort, 10),
    user: dbUser,
    password: dbPass,
    database: dbName,
  });

  await client2.connect();
  const res = await client2.query('SELECT * FROM timekeeping_device');
  console.log("Devices in DB:", JSON.stringify(res.rows, null, 2));
  await client2.end();
}

main().catch(console.error);
