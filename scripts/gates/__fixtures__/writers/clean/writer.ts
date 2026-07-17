await pool.query(`INSERT INTO session_log (anon_id) VALUES ($1)`, [anonId]);
