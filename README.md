# dev-pulse-agents

Multi-agent workflow system using Vercel AI SDK

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Copy `.env.example` to `.env` and add your API keys:
```bash
cp .env.example .env
```

3. Run the development server:
```bash
pnpm dev
```

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
