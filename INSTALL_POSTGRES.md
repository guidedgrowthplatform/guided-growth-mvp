# Installing PostgreSQL on macOS

## Option 1: Homebrew (Command Line)

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create the database
createdb life_growth_tracker

# Verify it's running
psql -d life_growth_tracker -c "SELECT version();"
```

## Option 2: PostgreSQL.app (GUI - Easier)

1. Download from: https://postgresapp.com/
2. Install and open PostgreSQL.app
3. Click "Initialize" to create a new server
4. Note the connection details shown

## Option 3: Docker Desktop

1. Download Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Install and start Docker Desktop
3. Run: `docker compose up -d`

## After Installation

Update your `.env` file:

**For Homebrew:**
```
DATABASE_URL=postgresql://$(whoami)@localhost:5432/life_growth_tracker
```

**For PostgreSQL.app:**
```
DATABASE_URL=postgresql://localhost:5432/life_growth_tracker
```

**For Docker:**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/life_growth_tracker
```

Then run migrations:
```bash
cd server
npm run migrate
```


