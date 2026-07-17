await pool.query(`INSERT INTO session_log (anon_id) VALUES ($1)`, [anonId]);
await pool.query(`DELETE FROM session_log WHERE anon_id = $1`, [anonId]);
