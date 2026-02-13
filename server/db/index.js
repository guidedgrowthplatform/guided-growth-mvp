import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from project root (two levels up from server/db/)
dotenv.config({ path: join(__dirname, '../../.env') })

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set!')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL in production (check for both supabase.co and pooler.supabase.com)
  ssl: process.env.NODE_ENV === 'production' || 
       process.env.DATABASE_URL?.includes('supabase.co') || 
       process.env.DATABASE_URL?.includes('pooler.supabase.com')
    ? { rejectUnauthorized: false } 
    : false,
  // Connection pool settings for serverless
  max: 1, // Limit connections for serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
  // Don't exit in serverless - just log the error
  if (process.env.VERCEL !== '1') {
    process.exit(-1)
  }
})

export default pool

