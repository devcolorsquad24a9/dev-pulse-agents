FROM node:20-alpine

WORKDIR /app

# Copy package files first (for better caching)
COPY package.json package-lock.json* ./

# Install all dependencies (dev + prod)
# This ensures dev dependencies are available locally
RUN npm ci && npm cache clean --force

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
CMD ["node", "dist/index.js"]

