import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  const result = await pool.query(
    "SELECT id, email, role, is_active FROM app_users WHERE email = $1",
    ["j.raafat@ucf-eg.com"]
  );

  console.log(result.rows);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
