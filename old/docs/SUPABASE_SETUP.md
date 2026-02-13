# Supabase Deployment Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: life-growth-tracker (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is fine for beta

## Step 2: Get Connection Details

Once project is created:

1. Go to **Settings** → **Database**
2. Find **Connection string** section
3. Copy the **URI** connection string (looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)

## Step 3: Update Environment Variables

Update your `.env` file with Supabase connection:

```env
# Database - Use Supabase connection string
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Keep other variables the same
PORT=3000
NODE_ENV=production
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback
SESSION_SECRET=your_random_session_secret_here_min_32_chars
ADMIN_EMAIL=your-email@gmail.com
CORS_ORIGIN=https://your-frontend-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Step 4: Run Migrations on Supabase

```bash
cd server
npm run migrate
```

This will create all tables in your Supabase database.

## Step 5: Seed Admin Email

```bash
cd server
npm run seed
```

## Step 6: Update Google OAuth Redirect URI

In Google Cloud Console:
1. Go to your OAuth credentials
2. Add authorized redirect URI: `https://your-backend-domain.com/auth/google/callback`
3. Update `GOOGLE_CALLBACK_URL` in `.env`

## Step 7: Deploy Backend

Options:
- **Vercel**: Good for serverless
- **Railway**: Easy deployment
- **Render**: Simple setup
- **Fly.io**: Good performance

## Step 8: Deploy Frontend

- **Vercel**: Recommended for React apps
- **Netlify**: Also great
- Update `CORS_ORIGIN` in backend `.env` to match frontend URL

## Supabase-Specific Considerations

### Connection Pooling

Supabase recommends using connection pooling for serverless functions. Update connection:

```javascript
// For serverless (Vercel, etc.)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true

// For traditional servers
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### SSL Connection

Supabase requires SSL. The current code already handles this:

```javascript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
```

### Supabase Auth (Optional)

You could also use Supabase Auth instead of Google OAuth, but since we've built Google OAuth, we'll stick with that for now.

## Testing Supabase Connection

```bash
# Test connection
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Or use Supabase SQL Editor
# Go to SQL Editor in Supabase dashboard
```

## Security Notes

- Never commit `.env` file
- Use Supabase's built-in secrets management if available
- Enable Row Level Security (RLS) in Supabase if needed
- Set up database backups in Supabase dashboard

