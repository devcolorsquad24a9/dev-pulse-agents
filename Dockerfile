FROM node:22-bookworm-slim

WORKDIR /app

# Copy package files first (for better caching)
COPY package.json package-lock.json* ./

# Install all dependencies (dev + prod)
# This ensures dev dependencies are available locally
RUN npm ci --no-audit --no-fund && npm cache clean --force

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src

# Build the project
RUN npm run build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Default command (can be overridden)
# Note: With rootDir: "./", src files compile to dist/src/
CMD ["node", "dist/src/index.js"]

