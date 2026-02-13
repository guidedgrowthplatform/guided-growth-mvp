// Vercel serverless function entry point
// Load environment variables first
import dotenv from 'dotenv'
dotenv.config()

// Import app after env vars are loaded
import app from '../server.js'

// Vercel expects the handler to be the app itself
export default app

