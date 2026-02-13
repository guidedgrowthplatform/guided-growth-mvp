import dotenv from 'dotenv'
import pool from '../db/index.js'

dotenv.config()

async function seed() {
  const adminEmail = process.env.ADMIN_EMAIL

  if (!adminEmail) {
    console.error('ADMIN_EMAIL not set in .env')
    process.exit(1)
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Add admin email to allowlist if not exists
    const allowlistCheck = await client.query(
      'SELECT id FROM allowlist WHERE email = $1',
      [adminEmail]
    )

    if (allowlistCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO allowlist (email, note) VALUES ($1, $2)',
        [adminEmail, 'Initial admin user - seeded on setup']
      )
      console.log(`✓ Added ${adminEmail} to allowlist`)
    } else {
      console.log(`✓ ${adminEmail} already in allowlist`)
    }

    await client.query('COMMIT')
    console.log('Seed completed!')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()


