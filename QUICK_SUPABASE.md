# Quick Supabase Setup

## 1. Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in:
   - **Name**: `life-growth-tracker`
   - **Database Password**: Generate and **SAVE THIS PASSWORD**
   - **Region**: Choose closest to you
   - Click "Create new project"

Wait 2-3 minutes for project to initialize.

## 2. Get Connection String

1. In Supabase dashboard, go to **Settings** → **Database**
2. Scroll to **Connection string** section
3. Select **URI** tab
4. Copy the connection string (looks like):
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
   
   **OR** for direct connection:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

## 3. Update .env File

Replace `DATABASE_URL` in your `.env`:

```bash
# Use the connection string from Supabase
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Set to production
NODE_ENV=production
```

## 4. Test Connection

```bash
cd server
npm run test-connection
```

## 5. Run Migrations

```bash
cd server
npm run migrate
```

## 6. Seed Admin

```bash
cd server
npm run seed
```

## 7. Verify in Supabase Dashboard

1. Go to **Table Editor** in Supabase
2. You should see:
   - `users`
   - `allowlist`
   - `admin_audit_log`
   - `reports`
   - `schema_migrations`

## 8. Update Google OAuth

In Google Cloud Console, add your production callback URL:
- `https://your-backend-domain.com/auth/google/callback`

## Next: Deploy Backend

Choose a hosting platform:
- **Vercel** (recommended for serverless)
- **Railway** (easy setup)
- **Render** (simple)
- **Fly.io** (good performance)

## Connection Pooling Note

For serverless (Vercel), use the **pooler** connection string (port 6543) instead of direct (port 5432).

