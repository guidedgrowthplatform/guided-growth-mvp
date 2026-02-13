import pool from '../db/index.js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from project root (three levels up: scripts -> server -> root)
const envPath = join(__dirname, '../../.env')
dotenv.config({ path: envPath })

// Debug: Check if file was loaded
if (!process.env.DATABASE_URL) {
  console.warn(`⚠️  Warning: DATABASE_URL not found. Tried loading from: ${envPath}`)
  console.warn(`   Current working directory: ${process.cwd()}`)
}

async function testConnection() {
  try {
    console.log('Testing database connection...')
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'))
    
    const result = await pool.query('SELECT version(), current_database(), current_user')
    
    console.log('\n✅ Connection successful!')
    console.log('PostgreSQL version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1])
    console.log('Database:', result.rows[0].current_database)
    console.log('User:', result.rows[0].current_user)
    
    // Test if tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    
    if (tables.rows.length > 0) {
      console.log('\n📊 Existing tables:')
      tables.rows.forEach(row => console.log('  -', row.table_name))
    } else {
      console.log('\n📊 No tables found. Run migrations first.')
    }
    
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Connection failed:')
    console.error('Error:', error.message)
    if (error.code) {
      console.error('Error code:', error.code)
    }
    await pool.end()
    process.exit(1)
  }
}

testConnection()

