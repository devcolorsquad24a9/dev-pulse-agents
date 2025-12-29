# dev-pulse-agents

Multi-agent workflow system using Vercel AI SDK

## Setup

### Local Development (without Docker)

1. Install dependencies:
```bash
npm install
# or
pnpm install
```

2. Copy `.env.example` to `.env` and add your API keys:
```bash
cp .env.example .env
```

3. Run the development server:
```bash
npm run dev
# or
pnpm dev
```

### Docker Development

1. Copy `.env.example` to `.env` and add your API keys:
```bash
cp .env.example .env
```

2. Start the development container:
```bash
docker compose up dev
```

The container will:
- Install all dependencies (including dev dependencies)
- Mount your source code for hot reload
- Run the development server with `tsx watch`

3. To stop the container:
```bash
docker compose down
```

### Docker Production

1. Build and run the production container:
```bash
docker compose up prod
```

Or build and run manually:
```bash
docker build -t dev-pulse-agents .
docker run -p 3000:3000 --env-file .env dev-pulse-agents
```

## Managing Dependencies

### Adding New Dependencies

When you add new dependencies to `package.json`, you need to rebuild the Docker image to include them:

1. **Add the dependency locally first:**
```bash
npm install <package-name>
# or for dev dependencies
npm install -D <package-name>
```

2. **Rebuild the Docker image:**
```bash
# Rebuild the dev container
docker compose build dev

# Or rebuild both dev and prod
docker compose build
```

3. **Restart the container:**
```bash
docker compose up dev
```

**Note:** The Docker image caches the `node_modules` layer based on `package.json` and `package-lock.json`. When these files change, Docker will automatically rebuild that layer on the next build. However, if you're already running a container, you need to rebuild and restart it.

### Updating Dependencies

1. **Update dependencies locally:**
```bash
npm update
# or update a specific package
npm update <package-name>
```

2. **Rebuild the Docker image:**
```bash
docker compose build
```

3. **Restart containers:**
```bash
docker compose up dev
```

### Best Practices

- **Always commit `package-lock.json`**: This ensures consistent dependency versions across environments
- **Rebuild after dependency changes**: The container won't automatically pick up new dependencies until you rebuild
- **Use volumes in dev**: The dev setup mounts your local `src` directory, so code changes reflect immediately without rebuilds
- **Production uses built image**: Production containers don't use volumes, ensuring consistency and security

## Project Structure

```
src/
  agents/     # Agent implementations (to be added)
  tools/      # Shared tools (to be added)
  workflows/  # Workflow definitions (to be added)
  index.ts    # Main entry point
```

## Resources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Web Search Agent Cookbook](https://ai-sdk.dev/cookbook/node/web-search-agent)
