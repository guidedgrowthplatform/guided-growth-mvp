import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from '../db/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../db/migrations')
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`Found ${files.length} migration(s)`)

  const client = await pool.connect()
  
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)

    for (const file of files) {
      const version = file.replace('.sql', '')
      
      // Check if migration already applied
      const result = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      )

      if (result.rows.length > 0) {
        console.log(`✓ Migration ${version} already applied`)
        continue
      }

      console.log(`Running migration ${version}...`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        )
        await client.query('COMMIT')
        console.log(`✓ Migration ${version} applied successfully`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }

    console.log('All migrations completed!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

runMigrations()


