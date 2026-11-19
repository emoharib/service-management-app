import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  const columns = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'children' ORDER BY ordinal_position"
  );

  const count = await pool.query(
    "SELECT COUNT(*)::int AS total FROM children"
  );

  console.log("CHILDREN COLUMNS:");
  console.table(columns.rows);
  console.log("TOTAL RECORDS:", count.rows[0].total);
} catch (error) {
  console.error("DATABASE ERROR:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
