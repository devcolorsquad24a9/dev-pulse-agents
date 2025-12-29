# dev-pulse-agents

Multi-agent workflow system using Vercel AI SDK with Express.js backend

## Overview

This project provides a multi-agent system built with the Vercel AI SDK, featuring:
- **Web Search Agent** - Performs web searches and retrieves relevant information
- **Comparison Agent** - Compares multiple items, products, or concepts
- **Recommendation Agent** - Provides personalized recommendations based on user preferences
- **Newsletter Agent** - Generates newsletter content based on topics and preferences

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Make (optional, for convenience commands)

## Quick Start

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

- `make help` - Show all available commands
- `make setup-docker-env` - Create/update `.env.local` with Neon Local DATABASE_URL
- `make setup-check` - Check if environment files are set up correctly
- `make pull-vercel-env` - Pull environment variables from Vercel to `.env.local`
- `make dev` - Start backend and Neon Local database
- `make stop` - Stop all Docker Compose services
- `make restart` - Restart all services
- `make status` - Show status of running services
- `make logs` - Show log viewing instructions and API examples
- `make docker-down` - Stop services and remove containers
- `make clean` - Remove containers, volumes, and built images
- `make build` - Build Docker images without starting

### Docker Compose Commands

```bash
# Start services
docker-compose --profile dev up -d

# View logs
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
```bash
POST /api/agents/web-search
Content-Type: application/json

{
  "query": "your search query"
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

# Web search
curl -X POST http://localhost:3000/api/agents/web-search \
  -H "Content-Type: application/json" \
  -d '{"query": "latest AI developments"}'

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
    webSearchAgent.ts   # Web search functionality
    comparisonAgent.ts # Comparison functionality
    recommendationAgent.ts # Recommendation functionality
    newsletterAgent.ts # Newsletter generation
    index.ts           # Agent exports
  tools/               # Shared tools (to be added)
  workflows/           # Workflow definitions (to be added)
  index.ts             # Express.js server entry point
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
# Database (for Neon Local)
DATABASE_URL=postgresql://neon:npg@neon-local:5432/neondb?sslmode=no-verify

# AI Provider API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key  # optional
GOOGLE_API_KEY=your_google_api_key        # optional

# Server
PORT=3000
NODE_ENV=development
```

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

The project uses **Neon Local** for local database development. Neon Local connects to your Neon cloud database and provides a local PostgreSQL instance.

- **Port**: 5432
- **Connection**: Managed via `DATABASE_URL` in `.env.local`
- **Health Check**: Automatically configured in docker-compose.yml

## Resources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Web Search Agent Cookbook](https://ai-sdk.dev/cookbook/node/web-search-agent)
- [Neon Local Documentation](https://neon.tech/docs/guides/neon-local)

## License

MIT
