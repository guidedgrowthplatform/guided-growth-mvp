# Quick Deploy Checklist

## Current Status: Ready to Deploy! 🚀

All configuration files are in place. Follow these steps:

## Step 1: Supabase Setup (5 minutes)

```bash
# 1. Create Supabase project at https://supabase.com
# 2. Get connection string from Settings → Database
# 3. Update local .env:
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# 4. Test connection
cd server && npm run test-connection

# 5. Run migrations
cd server && npm run migrate

# 6. Seed admin
cd server && npm run seed
```

## Step 2: Deploy Backend (10 minutes)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy backend
cd server
vercel

# 4. Note your backend URL (e.g., https://xxx.vercel.app)
```

**Then in Vercel Dashboard:**
- Go to your project → Settings → Environment Variables
- Add all variables from `.env` (use pooler connection for DATABASE_URL)
- Use port 6543 for serverless: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`
- Redeploy: `vercel --prod`

## Step 3: Deploy Frontend (5 minutes)

```bash
# From project root
vercel

# In Vercel Dashboard:
# Add environment variable:
VITE_API_URL=https://your-backend-url.vercel.app
```

## Step 4: Configure Google OAuth (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials
3. Edit your OAuth 2.0 Client
4. Add authorized redirect URI:
   ```
   https://your-backend-url.vercel.app/auth/google/callback
   ```

## Step 5: Test (5 minutes)

1. Visit your frontend URL
2. Test OAuth login
3. Test admin panel at `/admin`
4. Test data capture

## Environment Variables Checklist

### Backend (Vercel)
- [ ] `DATABASE_URL` (pooler connection)
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `GOOGLE_CALLBACK_URL` (production URL)
- [ ] `SESSION_SECRET`
- [ ] `ADMIN_EMAIL`
- [ ] `CORS_ORIGIN` (frontend URL)
- [ ] `NODE_ENV=production`

### Frontend (Vercel)
- [ ] `VITE_API_URL` (backend URL)

## Troubleshooting

**Database connection fails:**
- Use pooler connection (port 6543) for Vercel
- Check `NODE_ENV=production` is set

**OAuth redirect error:**
- Verify callback URL matches exactly in Google Console
- Check `GOOGLE_CALLBACK_URL` in environment variables

**CORS errors:**
- Ensure `CORS_ORIGIN` matches frontend URL exactly (with https://)
- No trailing slash

## Files Created

- ✅ `DEPLOYMENT_STATUS.md` - Current status and checklist
- ✅ `DEPLOYMENT_GUIDE.md` - Detailed step-by-step guide
- ✅ `server/vercel.json` - Backend Vercel config
- ✅ `vercel.json` - Frontend Vercel config
- ✅ `src/utils/api.js` - API utility for frontend

## Next Steps After Deployment

1. Test with real users
2. Monitor Vercel function logs
3. Set up Supabase backups
4. Consider custom domain
5. Add error tracking (Sentry)

