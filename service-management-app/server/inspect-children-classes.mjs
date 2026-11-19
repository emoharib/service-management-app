import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await pool.query(`
    SELECT sc.name AS class_name, COUNT(c.id)::int AS children_count
    FROM service_classes sc
    LEFT JOIN children c ON c.class_id = sc.id
    GROUP BY sc.id, sc.name, sc.sort_order
    ORDER BY sc.sort_order
  `);

  console.table(result.rows);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
