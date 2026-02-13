# Testing Guide - Beta User Management

## Quick Start Testing

### Step 1: Start PostgreSQL Database

```bash
docker-compose up -d
```

Verify it's running:
```bash
docker-compose ps
```

### Step 2: Install Server Dependencies

```bash
cd server
npm install
```

### Step 3: Create `.env` File

Create `.env` in the root directory:

```bash
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/life_growth_tracker
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
SESSION_SECRET=change-me-to-random-secret-min-32-characters-long
ADMIN_EMAIL=your-email@gmail.com
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Important:** Replace:
- `your-email@gmail.com` with your actual Gmail address
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` with your Google OAuth credentials

### Step 4: Run Database Migrations

```bash
cd server
npm run migrate
```

### Step 5: Seed Admin Email

```bash
cd server
npm run seed
```

This adds your `ADMIN_EMAIL` to the allowlist.

### Step 6: Start Backend Server

```bash
cd server
npm run dev
```

**Backend runs on:** `http://localhost:3000`

### Step 7: Start Frontend (in a new terminal)

```bash
# From project root
npm run dev
```

**Frontend runs on:** `http://localhost:5173`

## Testing URLs

### Frontend Application
- **Main App:** http://localhost:5173
- **Admin Panel:** http://localhost:5173/admin (requires admin login)

### Backend API Endpoints

#### Health Check
```bash
curl http://localhost:3000/health
```

#### Authentication
- **Login:** http://localhost:3000/auth/google
- **Callback:** http://localhost:3000/auth/google/callback (automatic redirect)
- **Current User:** http://localhost:3000/auth/me (requires session)
- **Logout:** POST http://localhost:3000/auth/logout

#### Admin Endpoints (require admin role)
- **List Users:** GET http://localhost:3000/api/admin/users
- **List Allowlist:** GET http://localhost:3000/api/admin/allowlist
- **Audit Log:** GET http://localhost:3000/api/admin/audit-log

#### Reports (example resource)
- **List Reports:** GET http://localhost:3000/api/reports
- **Create Report:** POST http://localhost:3000/api/reports

## Testing Flow

### 1. Test Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-06T...",
  "database": "connected"
}
```

### 2. Test Google OAuth Login

1. Open browser to: http://localhost:5173
2. You'll need to add a login button or navigate directly to: http://localhost:3000/auth/google
3. Complete Google OAuth flow
4. You'll be redirected back to frontend

**Note:** For testing without full OAuth setup, you can:
- Use Google OAuth credentials from Google Cloud Console
- Or temporarily modify the auth route to allow test users

### 3. Test Admin Panel

1. Log in with your `ADMIN_EMAIL`
2. Navigate to: http://localhost:5173/admin
3. You should see:
   - Users tab (list all users)
   - Allowlist tab (manage allowed emails)
   - Audit Log tab (view admin actions)

### 4. Test Allowlist Enforcement

1. Try logging in with an email NOT in the allowlist
2. Should see "Access denied (not invited)" message

### 5. Test Data Isolation

Create a report as one user, then verify another user cannot access it:

```bash
# As User A (requires session cookie)
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Report", "content": "Private data"}' \
  --cookie-jar cookies.txt \
  --cookie cookies.txt

# As User B (different session)
# Should return 404 or empty list
curl http://localhost:3000/api/reports \
  --cookie-jar cookies2.txt \
  --cookie cookies2.txt
```

## Running Tests

### Unit/Integration Tests

```bash
cd server
npm test
```

Tests verify:
- Data isolation (User A cannot access User B's data)
- Disabled user blocking
- Admin-only endpoint protection

## Troubleshooting

### Database Connection Error

```bash
# Check if PostgreSQL is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart if needed
docker-compose restart postgres
```

### OAuth Not Working

1. Verify Google OAuth credentials in `.env`
2. Check redirect URI matches exactly: `http://localhost:3000/auth/google/callback`
3. Ensure OAuth consent screen is configured in Google Cloud Console

### "Access Denied" on Login

1. Check if your email is in allowlist:
   ```bash
   # Connect to database
   docker-compose exec postgres psql -U postgres -d life_growth_tracker
   
   # Check allowlist
   SELECT * FROM allowlist;
   ```

2. Add your email if missing:
   ```bash
   # Via admin panel (after logging in as admin)
   # Or directly in database:
   INSERT INTO allowlist (email, note) VALUES ('your-email@gmail.com', 'Test user');
   ```

### Frontend Can't Connect to Backend

1. Verify backend is running on port 3000
2. Check Vite proxy config in `vite.config.js`
3. Verify `CORS_ORIGIN` in `.env` matches frontend URL

## Quick Test Checklist

- [ ] PostgreSQL running (`docker-compose ps`)
- [ ] Backend server running (`http://localhost:3000/health` returns healthy)
- [ ] Frontend running (`http://localhost:5173` loads)
- [ ] Can log in with Google OAuth
- [ ] Admin email auto-promoted to admin role
- [ ] Can access `/admin` panel
- [ ] Can view users list
- [ ] Can add email to allowlist
- [ ] Non-allowlisted email blocked from login
- [ ] Can create/view reports (user-owned data)
- [ ] Tests pass (`npm test` in server directory)


