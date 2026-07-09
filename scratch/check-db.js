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
  console.log('Connected to DB');

  try {
    const studentGrowth = await client.query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM students
       GROUP BY month
       ORDER BY month ASC
       LIMIT 6`
    );
    console.log('Student Growth:', studentGrowth.rows);

    const billsCount = await client.query('SELECT count(*)::int FROM student_monthly_bills');
    console.log('Bills Count in DB:', billsCount.rows[0].count);

    const billsSample = await client.query('SELECT month, total_amount, paid_amount, status FROM student_monthly_bills');
    console.log('Bills Sample:', billsSample.rows);

    const courseDistribution = await client.query(
      `SELECT c.name AS name, COUNT(DISTINCT cs.student_id)::int AS value
       FROM courses c
       JOIN classes cl ON cl.course_id = c.id
       JOIN class_students cs ON cs.class_id = cl.id
       WHERE cs.status = 'Active'
       GROUP BY c.name
       ORDER BY value DESC
       LIMIT 5`
    );
    console.log('Course Distribution:', courseDistribution.rows);

    const students = await client.query('SELECT count(*) FROM students');
    console.log('Total students in DB:', students.rows[0].count);
    
    const courses = await client.query('SELECT name, category FROM courses');
    console.log('Courses in DB:', courses.rows);

  } catch (err) {
    console.error('Error running queries:', err);
  } finally {
    await client.end();
  }
}

main();
