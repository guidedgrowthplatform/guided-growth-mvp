# Setup Without Docker

If you don't have Docker, you can install PostgreSQL directly on macOS.

## Option 1: Install PostgreSQL with Homebrew

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create database
createdb life_growth_tracker

# Or connect and create manually
psql postgres
CREATE DATABASE life_growth_tracker;
\q
```

Then update your `.env` file:
```
DATABASE_URL=postgresql://$(whoami)@localhost:5432/life_growth_tracker
```

## Option 2: Install PostgreSQL.app (GUI)

1. Download from: https://postgresapp.com/
2. Install and launch PostgreSQL.app
3. Click "Initialize" to create a new server
4. Use the connection string shown in the app

## Option 3: Use SQLite for Quick Testing (Simplified)

If you just want to test quickly without PostgreSQL, you can modify the database connection to use SQLite. However, this requires code changes and is not recommended for production-like testing.

## After PostgreSQL is Running

Once PostgreSQL is set up, continue with:

```bash
# 1. Install server dependencies
cd server
npm install

# 2. Create .env file (see SETUP.md)

# 3. Run migrations
npm run migrate

# 4. Seed admin
npm run seed

# 5. Start server
npm run dev
```

## Verify PostgreSQL is Running

```bash
# Check if PostgreSQL is running
psql -d life_growth_tracker -c "SELECT version();"

# Or check via Homebrew
brew services list | grep postgresql
```


