# dev-pulse-agents

Multi-agent workflow system using Vercel AI SDK with Express.js backend

## Frontend (Vercel)

This repo now includes a simple newsletter landing page in `web/` (Next.js App Router). It:
- Explains the Dev Pulse newsletter/agent concept (from `notes.txt`)
- Captures **email** (required) plus **name** and **job role** (optional)
- Stores submissions in Postgres: `id`, `created_at`, `name`, `email`, `job_role`

### Deploy to Vercel

1. Create a new Vercel project pointing at this repo.
2. In the Vercel project settings, set **Root Directory** to `web`.
3. Add Vercel Postgres to the project (Storage → Postgres). This will provision and inject the required env vars.
4. Create the table by running the SQL in `web/db/schema.sql` in your Postgres instance (Vercel Storage query UI works fine).

### Local dev (frontend)

From the repo root:

```bash
cd web
npm install
```

Set a Postgres connection string (for local Postgres, or use Vercel Postgres connection envs). The API route uses `@vercel/postgres` and expects `POSTGRES_URL` to be set.

```bash
export POSTGRES_URL="postgres://user:pass@host:5432/dbname?sslmode=require"
npm run dev
```

## Setup

This project provides a multi-agent system built with the Vercel AI SDK, featuring:
- **Web Search Agent** - Scrapes tool changelogs, stores them in Vercel Blob, generates embeddings, and enables semantic search across changelogs using pgvector
- **Comparison Agent** - Compares multiple items, products, or concepts
- **Recommendation Agent** - Provides personalized recommendations based on user preferences
- **Newsletter Agent** - Generates newsletter content based on topics and preferences

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Make (optional, for convenience commands)
- Neon CLI (for database branch management) - Install with `npm install -g neonctl` or `brew install neonctl`

## Quick Start

### Initial Setup (First Time Only)

1. **Setup Neon CLI and create database branches:**
```bash
# Install Neon CLI (if not already installed)
npm install -g neonctl
# or
brew install neonctl

# Authenticate with Neon
make neon-setup

# Create preview branch from main (for local dev and preview deployments)
make neon-branch-preview-create NEON_PROJECT_ID=your-project-id

# Get connection strings for both branches
make neon-connection-strings NEON_PROJECT_ID=your-project-id
```

2. **Create environment files:**
   - Create `.env.preview` with preview branch connection string (format shown in output)
   - Create `.env.production` with main branch connection string (format shown in output)

3. **Run initial database migrations:**
```bash
# Run migrations on preview branch (safe for testing)
make migrate-preview

# Run migrations on production (requires confirmation)
make migrate-production
```

### Using Makefile (Recommended)

1. **Setup environment:**
```bash
make setup-docker-env
```

2. **Start services:**
```bash
make dev
```

3. **Check status:**
```bash
make status
```

4. **View logs:**
```bash
make logs
```

5. **Stop services:**
```bash
make stop
```

### Manual Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Create environment file:**
```bash
# Create .env.local with your API keys
cp .env.example .env.local  # if you have an example file
# Or create manually with:
# DATABASE_URL=postgresql://neon:npg@neon-local:5432/neondb?sslmode=no-verify
# OPENAI_API_KEY=your_key_here
# ANTHROPIC_API_KEY=your_key_here (optional)
# GOOGLE_API_KEY=your_key_here (optional)
```

3. **Start with Docker Compose:**
```bash
docker-compose --profile dev up
```

4. **Or run locally (without Docker):**
```bash
npm run dev
```

## Docker Development

The project uses Docker Compose with two services:

- **backend** - Express.js API server (port 3000)
- **neon-local** - Neon Local database (port 5432)

### Available Makefile Commands

#### Development Commands
- `make help` - Show all available commands
- `make setup-docker-env` - Create/update `.env.local` with Neon Local DATABASE_URL
- `make setup-check` - Check if environment files are set up correctly
- `make pull-vercel-env` - Pull environment variables from Vercel to `.env.local`
- `make dev` - Start backend and Neon Local database
- `make stop` - Stop all Docker Compose services
- `make restart` - Restart all services
- `make status` - Show status of running services
- `make logs` - Show Docker Compose logs (all services)
- `make logs LOGS_SERVICE=backend` - Show logs for a specific service
- `make logs-follow` - Follow logs in real-time (all services)
- `make logs-follow LOGS_SERVICE=backend` - Follow logs for a specific service
- `make logs-help` - Show log viewing help and API examples
- `make docker-down` - Stop services and remove containers
- `make clean` - Remove containers, volumes, and built images
- `make build` - Build Docker images without starting

#### Neon CLI Commands
- `make neon-setup` - Setup and authenticate Neon CLI
- `make neon-branch-preview-create NEON_PROJECT_ID=xxx` - Create preview branch from main
- `make neon-connection-strings NEON_PROJECT_ID=xxx` - Get connection strings for all branches

#### Database Migration Commands
- `make migrate-preview` - Run migrations on preview branch
- `make migrate-production` - Run migrations on production (main) branch (requires confirmation)
- `make migrate-info` - Show migration status for preview branch
- `make migrate-clean` - Clean migration history (development only, use with caution!)

### Docker Compose Commands

```bash
# Start services
docker-compose --profile dev up -d

# View logs (using Makefile - recommended)
make logs                    # Show all logs
make logs-follow             # Follow all logs in real-time
make logs LOGS_SERVICE=backend      # Show backend logs
make logs LOGS_SERVICE=neon-local   # Show neon-local logs
make logs-follow LOGS_SERVICE=backend # Follow backend logs

# Or use docker-compose directly
docker-compose --profile dev logs -f
docker-compose --profile dev logs -f backend
docker-compose --profile dev logs -f neon-local

# Stop services
docker-compose --profile dev down

# Rebuild images
docker-compose --profile dev build
```

## API Endpoints

The Express.js backend provides the following endpoints:

### Health Check
```bash
GET /health
```

### Web Search Agent

The Web Search Agent processes tool changelogs by scraping, storing in Vercel Blob, and creating vector embeddings for semantic search.

#### Process Changelogs
Scrapes changelogs from provided tools, stores them in Vercel Blob, and generates embeddings:
```bash
POST /api/agents/web-search/process
Content-Type: application/json

{
  "tools": [
    {"name": "cursor", "url": "https://cursor.com/changelog"},
    {"name": "windsurf", "url": "https://windsurf.com/changelog"}
  ]
}
```

#### Search Changelogs
Performs semantic search across stored changelog embeddings:
```bash
POST /api/agents/web-search/search
Content-Type: application/json

{
  "query": "What new features were added?",
  "toolName": "cursor",  // optional: filter by tool
  "limit": 10           // optional: default 10
}
```

### Comparison Agent
```bash
POST /api/agents/comparison
Content-Type: application/json

{
  "items": ["item1", "item2", "item3"]
}
```

### Recommendation Agent
```bash
POST /api/agents/recommendation
Content-Type: application/json

{
  "context": "user context or situation",
  "preferences": {
    "key": "value"
  }
}
```

### Newsletter Agent
```bash
POST /api/agents/newsletter
Content-Type: application/json

{
  "topics": ["topic1", "topic2"],
  "style": "professional" // optional
}
```

### Example API Calls

```bash
# Health check
curl http://localhost:3000/health

# Process changelogs
curl -X POST http://localhost:3000/api/agents/web-search/process \
  -H "Content-Type: application/json" \
  -d '{
    "tools": [
      {"name": "cursor", "url": "https://cursor.com/changelog"}
    ]
  }'

# Search changelogs
curl -X POST http://localhost:3000/api/agents/web-search/search \
  -H "Content-Type: application/json" \
  -d '{"query": "What new features were added?", "limit": 5}'

# Comparison
curl -X POST http://localhost:3000/api/agents/comparison \
  -H "Content-Type: application/json" \
  -d '{"items": ["React", "Vue", "Angular"]}'

# Recommendation
curl -X POST http://localhost:3000/api/agents/recommendation \
  -H "Content-Type: application/json" \
  -d '{"context": "building a web application", "preferences": {"language": "TypeScript"}}'

# Newsletter
curl -X POST http://localhost:3000/api/agents/newsletter \
  -H "Content-Type: application/json" \
  -d '{"topics": ["AI", "Web Development"], "style": "casual"}'
```

## Project Structure

```
src/
  agents/              # Agent implementations
    webSearchAgent.ts   # Changelog scraping, storage, and semantic search
    comparisonAgent.ts # Comparison functionality
    recommendationAgent.ts # Recommendation functionality
    newsletterAgent.ts # Newsletter generation
    index.ts           # Agent exports
  tools/               # Shared tools
    scraper.ts         # Firecrawl web scraping
    embeddings.ts      # OpenAI text embedding generation
  storage/             # Storage modules
    blob.ts            # Vercel Blob storage operations
  db/                  # Database modules
    client.ts          # PostgreSQL client connection
    vectorStore.ts     # Vector store operations (pgvector)
  workflows/           # Workflow definitions (to be added)
  index.ts             # Express.js server entry point
flyway/
  conf/                # Flyway configuration files
    flyway.conf        # Base configuration
    env_preview.conf   # Preview branch configuration
    env_production.conf # Production branch configuration
  sql/                 # Database migration files
    V1__Enable_pgvector.sql  # Initial migration (pgvector extension)
```

## Environment Variables

### Pulling from Vercel

If your project is deployed on Vercel, you can pull environment variables directly:

```bash
make pull-vercel-env
```

This command will:
- Pull all environment variables from your Vercel project
- Save them to `.env.local`
- Preserve your local `DATABASE_URL` for Neon Local (if it exists)
- Create a backup of your existing `.env.local` before pulling

**Note:** You need to have the Vercel CLI installed and be logged in:
```bash
npm install -g vercel
# or
brew install vercel-cli

# Then login
vercel login
```

### Manual Setup

Create a `.env.local` file in the project root:

```env
# Database (for Neon Local - connects to preview branch)
DATABASE_URL=postgresql://neon:npg@neon-local:5432/neondb?sslmode=no-verify

# AI Provider API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key  # optional
GOOGLE_API_KEY=your_google_api_key        # optional

# Web Scraping
FIRECRAWL_API_KEY=your_firecrawl_api_key

# Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# Server
PORT=3000
NODE_ENV=development
```

### Database Migration Environment Files

For Flyway migrations, create `.env.preview` and `.env.production` files:

**`.env.preview`** (for preview branch migrations):
```env
FLYWAY_URL=jdbc:postgresql://ep-xxx-xxx.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
FLYWAY_USER=your_user
FLYWAY_PASSWORD=your_password
```

**`.env.production`** (for production/main branch migrations):
```env
FLYWAY_URL=jdbc:postgresql://ep-yyy-yyy.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
FLYWAY_USER=your_user
FLYWAY_PASSWORD=your_password
```

Get connection strings using: `make neon-connection-strings NEON_PROJECT_ID=your-project-id`

## Managing Dependencies

### Adding New Dependencies

1. **Add the dependency locally:**
```bash
npm install <package-name>
# or for dev dependencies
npm install -D <package-name>
```

2. **Rebuild the Docker image:**
```bash
make build
# or
docker-compose --profile dev build
```

3. **Restart the container:**
```bash
make restart
# or
docker-compose --profile dev up -d
```

### Updating Dependencies

1. **Update dependencies locally:**
```bash
npm update
# or update a specific package
npm update <package-name>
```

2. **Rebuild and restart:**
```bash
make build
make restart
```

### Best Practices

- **Always commit `package-lock.json`**: Ensures consistent dependency versions
- **Rebuild after dependency changes**: Containers won't pick up new dependencies until rebuilt
- **Use volumes in dev**: The dev setup mounts your local `src` directory for hot reload
- **Environment files**: Use `.env.local` for local development (gitignored)

## Development

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Type check
npm run type-check
```

### Hot Reload

The Docker development setup uses `tsx watch` which automatically reloads when you change files in the `src/` directory. No need to restart the container for code changes.

## Database

The project uses **Neon** for database hosting with **Neon Local** for local development. Database schema changes are managed using **Flyway** migrations.

### Database Branch Strategy

- **Main Branch**: Production database
- **Preview Branch**: Shared between local development (via Neon Local) and preview deployments (e.g., Vercel previews)

This setup ensures:
- Local development and preview deployments are isolated from production
- Consistent schema management across all environments
- Safe testing of migrations before applying to production

### Neon Local

Neon Local connects to your Neon cloud database and provides a local PostgreSQL instance.

- **Port**: 5432
- **Connection**: Managed via `DATABASE_URL` in `.env.local` (points to `neon-local:5432`)
- **Health Check**: Automatically configured in docker-compose.yml
- **Target**: Configured to proxy to the preview branch via `BRANCH_ID` environment variable
- **Configuration**: The `BRANCH_ID` in `docker-compose.yml` specifies which Neon branch to connect to

### Database Migrations

Database schema changes are managed using Flyway. Migration files are located in `flyway/sql/` and follow the naming convention `V<version>__<description>.sql`.

**Running Migrations:**

```bash
# Test migrations on preview branch first
make migrate-preview

# Apply to production (requires confirmation)
make migrate-production

# Check migration status
make migrate-info
```

**Creating New Migrations:**

1. Create a new file in `flyway/sql/` following the naming convention:
   - Example: `V2__Create_users_table.sql`
2. Test on preview branch: `make migrate-preview`
3. Apply to production: `make migrate-production`

See `flyway/README.md` for more detailed migration documentation.

## Web Search Agent Details

The Web Search Agent implements a complete changelog processing and search pipeline:

1. **Scraping**: Uses Firecrawl to scrape changelog pages and extract content
2. **Storage**: Stores scraped content in Vercel Blob storage (organized by environment: `dev/` or `prod/`)
3. **Change Detection**: Uses content hashing to detect when changelogs have been updated
4. **Embedding Generation**: Chunks text and generates embeddings using OpenAI's `text-embedding-3-small` model
5. **Vector Storage**: Stores embeddings in Neon database using pgvector extension
6. **Semantic Search**: Performs cosine similarity search across all stored changelog embeddings

### Database Schema

The `changelog_embeddings` table stores:
- Tool name and URL
- Content chunks with their embeddings (1536 dimensions)
- Metadata (JSONB) for additional information
- Blob storage path for reference
- Timestamps for tracking updates

### Vector Search

The search endpoint uses cosine similarity to find the most relevant changelog content. Results are filtered by similarity threshold (>0.7) and can be optionally filtered by tool name.

## Resources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Web Search Agent Cookbook](https://ai-sdk.dev/cookbook/node/web-search-agent)
- [Embed Text Cookbook](https://ai-sdk.dev/cookbook/node/embed-text)
- [Neon Local Documentation](https://neon.tech/docs/guides/neon-local)
- [Neon Branching Guide](https://neon.com/docs/guides/branching-neon-cli)
- [Neon pgvector Extension](https://neon.com/docs/extensions/pgvector)
- [Flyway Documentation](https://flywaydb.org/documentation/)
- [Neon Flyway Multiple Environments](https://neon.com/docs/guides/flyway-multiple-environments)
- [Firecrawl Documentation](https://docs.firecrawl.dev/)
- [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob)

## License

MIT