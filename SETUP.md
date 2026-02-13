# Beta User Management Setup Guide

## Overview

This guide covers setting up the beta user management system with Google OAuth, allowlist, and admin panel.

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (for PostgreSQL)
- Google OAuth credentials

## Local Development Setup

### 1. Start PostgreSQL Database

```bash
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- Database: `life_growth_tracker`
- User: `postgres`
- Password: `postgres`

### 2. Install Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/life_growth_tracker

# Google OAuth (get from https://console.cloud.google.com/)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Session
SESSION_SECRET=your_random_session_secret_here_min_32_chars

# Admin
ADMIN_EMAIL=admin@example.com

# CORS
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Run Migrations

```bash
cd server
npm run migrate
```

This creates all necessary tables:
- `users` - User accounts
- `allowlist` - Email allowlist for access control
- `admin_audit_log` - Admin action audit trail
- `reports` - Example user-owned resource

### 5. Seed Initial Admin

```bash
cd server
npm run seed
```

This adds the `ADMIN_EMAIL` to the allowlist so you can log in.

### 6. Start the Application

**Backend Server:**
```bash
cd server
npm run dev
```

Server runs on `http://localhost:3000`

**Frontend:**
```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

## Testing

Run authorization tests:

```bash
cd server
npm test
```

Tests cover:
- Data isolation (User A cannot access User B's data)
- Disabled user access blocking
- Admin-only endpoint protection

## Accessing the Admin Panel

1. Log in with an email that's in the allowlist
2. If your email matches `ADMIN_EMAIL`, you'll automatically be promoted to admin
3. Navigate to `/admin` in the app
4. Manage users, allowlist, and view audit logs

## API Endpoints

### Authentication
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout

### Admin (requires admin role)
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:userId/role` - Update user role
- `PATCH /api/admin/users/:userId/status` - Update user status
- `GET /api/admin/allowlist` - List allowlist
- `POST /api/admin/allowlist` - Add email to allowlist
- `DELETE /api/admin/allowlist/:id` - Remove from allowlist
- `GET /api/admin/audit-log` - View audit log
- `GET /api/admin/users/:userId/data` - View user's data

### Reports (example user-owned resource)
- `GET /api/reports` - List user's reports
- `GET /api/reports/:id` - Get report
- `POST /api/reports` - Create report
- `PATCH /api/reports/:id` - Update report
- `DELETE /api/reports/:id` - Delete report

### Health
- `GET /health` - Health check endpoint

## Security Features

- **Rate Limiting**: Auth endpoints limited to 5 requests per 15 minutes
- **CORS**: Configured for frontend origin
- **Session Security**: HttpOnly cookies, secure in production
- **Data Isolation**: All queries scoped by user_id
- **Authorization Guards**: Middleware enforces access control
- **Audit Logging**: All admin actions logged

## Troubleshooting

**Database connection errors:**
- Ensure Docker container is running: `docker-compose ps`
- Check DATABASE_URL in `.env`

**OAuth errors:**
- Verify redirect URI matches exactly in Google Console
- Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

**Access denied:**
- Ensure email is in allowlist (check via admin panel or database)
- Verify user status is 'active'


