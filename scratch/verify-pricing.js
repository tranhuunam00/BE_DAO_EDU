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
    const levels = await client.query(`SELECT * FROM "course_levels"`);
    console.log('Course Levels:', levels.rows);
    
    const pricing = await client.query(`SELECT * FROM "course_level_pricing"`);
    console.log('Course Level Pricing:', pricing.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
