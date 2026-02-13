# Complete Deployment Guide - Supabase Production

This guide walks you through deploying the Life Growth Tracker to production with Supabase.

## Prerequisites

- Supabase account (free tier works)
- Google Cloud Console account (for OAuth)
- Vercel account (recommended) or alternative hosting
- Git repository (for easy deployment)

## Part 1: Supabase Database Setup

### Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `life-growth-tracker` (or your preferred name)
   - **Database Password**: Generate a strong password and **SAVE IT**
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is fine for beta
4. Click **"Create new project"**
5. Wait 2-3 minutes for project to initialize

### Step 2: Get Connection String

1. In Supabase dashboard, go to **Settings** → **Database**
2. Scroll to **Connection string** section
3. Select **URI** tab
4. Copy the connection string

   **For traditional server deployment (Railway, Render, etc.):**
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

   **For serverless deployment (Vercel):**
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

### Step 3: Test Connection Locally

1. Update your local `.env` file:
   ```env
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   NODE_ENV=production
   ```

2. Test the connection:
   ```bash
   cd server
   npm run test-connection
   ```

   You should see: `✅ Connection successful!`

### Step 4: Run Migrations

```bash
cd server
npm run migrate
```

This creates all tables in your Supabase database. Verify in Supabase dashboard:
- Go to **Table Editor**
- You should see: `users`, `allowlist`, `admin_audit_log`, `reports`, `schema_migrations`

### Step 5: Seed Admin Email

```bash
cd server
npm run seed
```

This adds your `ADMIN_EMAIL` from `.env` to the allowlist.

## Part 2: Backend Deployment (Vercel)

### Step 1: Prepare Backend for Vercel

Vercel configuration is already created (`vercel.json`). The backend is ready to deploy.

### Step 2: Deploy to Vercel

1. Install Vercel CLI (if not installed):
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from the `server` directory:
   ```bash
   cd server
   vercel
   ```

4. Follow the prompts:
   - Link to existing project? **No** (first time)
   - Project name: `life-growth-tracker-api` (or your choice)
   - Directory: **./** (current directory)
   - Override settings? **No**

5. After deployment, note your backend URL (e.g., `https://life-growth-tracker-api.vercel.app`)

### Step 3: Configure Environment Variables

1. Go to Vercel dashboard → Your project → **Settings** → **Environment Variables**

2. Add all required variables:

   ```env
   DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   NODE_ENV=production
   PORT=3000
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=https://your-backend-url.vercel.app/auth/google/callback
   SESSION_SECRET=your_random_secret_min_32_chars
   ADMIN_EMAIL=your-email@gmail.com
   CORS_ORIGIN=https://your-frontend-url.vercel.app
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

3. **Important**: Use the **pooler** connection string (port 6543) for Vercel serverless functions

4. Redeploy after adding environment variables:
   ```bash
   vercel --prod
   ```

### Step 4: Test Backend

1. Test health endpoint:
   ```bash
   curl https://your-backend-url.vercel.app/health
   ```

   Should return:
   ```json
   {
     "status": "healthy",
     "database": "connected"
   }
   ```

## Part 3: Frontend Deployment (Vercel)

### Step 1: Update Frontend Configuration

The frontend is already configured to use environment variables for the API URL.

### Step 2: Deploy to Vercel

1. From project root:
   ```bash
   vercel
   ```

2. Follow prompts:
   - Link to existing project? **No**
   - Project name: `life-growth-tracker` (or your choice)
   - Directory: **./** (current directory)
   - Override settings? **No**

3. After deployment, note your frontend URL

### Step 3: Configure Environment Variables

1. Go to Vercel dashboard → Frontend project → **Settings** → **Environment Variables**

2. Add:
   ```env
   VITE_API_URL=https://your-backend-url.vercel.app
   ```

3. Redeploy:
   ```bash
   vercel --prod
   ```

## Part 4: Google OAuth Configuration

### Step 1: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://your-backend-url.vercel.app/auth/google/callback
   ```
5. Click **Save**

### Step 2: Update Backend Environment

Make sure `GOOGLE_CALLBACK_URL` in Vercel matches the URL you added above.

## Part 5: Final Configuration

### Step 1: Update CORS

Make sure `CORS_ORIGIN` in backend environment variables matches your frontend URL exactly (including `https://`).

### Step 2: Test Everything

1. **Test OAuth Login:**
   - Go to your frontend URL
   - Click login (if implemented) or navigate to `/auth/google`
   - Complete Google OAuth flow
   - Should redirect back to frontend

2. **Test Admin Panel:**
   - Log in with admin email
   - Navigate to `/admin`
   - Should see users, allowlist, and audit log

3. **Test Data Capture:**
   - Navigate to `/capture`
   - Create entries
   - Verify data persists

## Troubleshooting

### Database Connection Issues

- **Error**: "Connection refused"
  - Check `DATABASE_URL` is correct
  - For Vercel, use pooler connection (port 6543)
  - Verify Supabase project is active

- **Error**: "SSL required"
  - SSL is already configured in code
  - Check `NODE_ENV=production` is set

### OAuth Issues

- **Error**: "Redirect URI mismatch"
  - Verify callback URL in Google Console matches exactly
  - Check `GOOGLE_CALLBACK_URL` in environment variables

### CORS Issues

- **Error**: "CORS policy blocked"
  - Verify `CORS_ORIGIN` matches frontend URL exactly
  - Include `https://` in the URL
  - No trailing slash

### Session Issues

- **Sessions not persisting**
  - Check `SESSION_SECRET` is set and secure
  - Verify cookies are being set (check browser DevTools)
  - For production, consider using database sessions or Redis

## Alternative Hosting Options

### Railway (Backend)

1. Connect GitHub repo
2. Select `server` directory as root
3. Add environment variables
4. Deploy

### Render (Backend)

1. Create new Web Service
2. Connect GitHub repo
3. Root directory: `server`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables

### Netlify (Frontend)

1. Connect GitHub repo
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variable: `VITE_API_URL`

## Next Steps

- [ ] Add custom domain (optional)
- [ ] Set up monitoring (Vercel Analytics)
- [ ] Configure backups in Supabase
- [ ] Set up error tracking (Sentry)
- [ ] Add database session storage for better scalability

## Support

If you run into issues:
1. Check Vercel function logs
2. Check Supabase logs
3. Test backend endpoints directly with `curl`
4. Verify all environment variables are set correctly

