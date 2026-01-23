FROM node:22-bookworm-slim

WORKDIR /app

# Copy package files first (for better caching)
COPY web/package.json web/package-lock.json* ./

# Install all dependencies
RUN npm ci --no-audit --no-fund && npm cache clean --force

# Copy source code and config
COPY web/tsconfig.json ./
COPY web/next.config.mjs ./
COPY web/postcss.config.mjs ./
COPY web/tailwind.config.ts ./
COPY web/app ./app
COPY web/components ./components
COPY web/lib ./lib
COPY web/db ./db

# Build Next.js application
RUN npm run build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Start Next.js production server
CMD ["npm", "start"]
