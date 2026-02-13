// Simple test endpoint
export default function handler(req, res) {
  res.json({ 
    status: 'ok', 
    message: 'Function is working',
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    }
  })
}

