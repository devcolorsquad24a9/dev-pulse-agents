# Flyway Database Migrations

This directory contains Flyway configuration and SQL migration files for managing database schema across environments.

## Structure

```
flyway/
├── conf/
│   ├── flyway.conf          # Base configuration
│   ├── env_preview.conf     # Preview branch configuration
│   └── env_production.conf  # Production (main) branch configuration
└── sql/
    └── V1__Enable_pgvector.sql  # Migration files (versioned)
```

## Setup

### 1. Create Neon Branches

First, set up your Neon branches:

```bash
# Install and authenticate Neon CLI
make neon-setup

# Create preview branch from main
make neon-branch-preview-create NEON_PROJECT_ID=your-project-id

# Get connection strings
make neon-connection-strings NEON_PROJECT_ID=your-project-id
```

### 2. Create Environment Files

Create `.env.preview` and `.env.production` files with the connection strings:

**`.env.preview`** (for preview branch):
```env
FLYWAY_URL=jdbc:postgresql://ep-xxx-xxx.us-east-2.aws.neon.tech:5432/neondb?sslmode=require
FLYWAY_USER=your_user
FLYWAY_PASSWORD=your_password
```

**`.env.production`** (for main branch):
```env
FLYWAY_URL=jdbc:postgresql://ep-yyy-yyy.us-east-2.aws.neon.tech:5432/neondb?sslmode=require
FLYWAY_USER=your_user
FLYWAY_PASSWORD=your_password
```

### 3. Run Migrations

```bash
# Run migrations on preview branch (safe for testing)
make migrate-preview

# Run migrations on production (requires confirmation)
make migrate-production

# Check migration status
make migrate-info
```

## Migration Naming Convention

Migration files follow Flyway's naming convention:
- `V<version>__<description>.sql`
- Example: `V1__Enable_pgvector.sql`, `V2__Create_users_table.sql`

## Environment Strategy

- **Preview Branch**: Used for local development (via Neon Local) and preview deployments (e.g., Vercel previews)
- **Main Branch**: Production database

This ensures local development and preview deployments are isolated from production while maintaining consistent schema management.

