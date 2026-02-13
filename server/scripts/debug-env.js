import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Try different paths
const paths = [
  join(__dirname, '../../.env'),
  join(process.cwd(), '../.env'),
  join(process.cwd(), '../../.env'),
  '.env',
  '../.env',
  '../../.env'
]

console.log('Current working directory:', process.cwd())
console.log('Script directory:', __dirname)
console.log('\nTrying to find .env file...\n')

for (const path of paths) {
  const resolved = join(process.cwd(), path)
  console.log(`Checking: ${resolved}`)
  if (fs.existsSync(resolved)) {
    console.log(`✅ Found .env at: ${resolved}`)
    const result = dotenv.config({ path: resolved })
    if (result.error) {
      console.log(`❌ Error loading: ${result.error.message}`)
    } else {
      console.log(`✅ Loaded successfully`)
      console.log(`DATABASE_URL present: ${!!process.env.DATABASE_URL}`)
      if (process.env.DATABASE_URL) {
        console.log(`DATABASE_URL length: ${process.env.DATABASE_URL.length}`)
        console.log(`DATABASE_URL preview: ${process.env.DATABASE_URL.substring(0, 60)}...`)
      }
      break
    }
  } else {
    console.log(`❌ Not found`)
  }
}

// Also try loading from project root directly
const projectRoot = join(__dirname, '../..')
const rootEnv = join(projectRoot, '.env')
console.log(`\nTrying project root: ${rootEnv}`)
if (fs.existsSync(rootEnv)) {
  console.log('✅ Found .env at project root')
  const result = dotenv.config({ path: rootEnv })
  if (result.error) {
    console.log(`❌ Error: ${result.error.message}`)
  } else {
    console.log(`✅ Loaded from project root`)
    console.log(`DATABASE_URL present: ${!!process.env.DATABASE_URL}`)
  }
} else {
  console.log('❌ Not found at project root')
}

