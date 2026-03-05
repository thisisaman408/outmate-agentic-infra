# ============================================================================
# PRODUCTION-GRADE DOCKERFILE FOR OUTMATE.AI FRONTEND
# ============================================================================
# Multi-stage build for Next.js optimized production image
#
# Build Stages:
# 1. base - Node.js base image
# 2. builder - Build Next.js application
# 3. runtime - Minimal production image (serves optimized build)
#
# Features:
# - Multi-stage build (minimal final image)
# - Non-root user for security
# - Health check endpoint
# - Optimized for Vercel deployment or standalone server
# - Static optimization and compression
#
# Build: docker build -t outmate-web:latest .
# Run:   docker run -p 3000:3000 outmate-web:latest
# ============================================================================

FROM node:18-alpine as base

# Set environment variables for Next.js
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

WORKDIR /app

# Install pnpm package manager
RUN npm install -g pnpm


# ============================================================================
# Builder stage - Build Next.js application
# ============================================================================
FROM base as builder

# Copy package files
COPY pnpm-lock.yaml .
COPY package.json .

# Install dependencies (using pnpm for speed and efficiency)
RUN pnpm install --frozen-lockfile --prod=false

# Copy application files
COPY . .

# Build Next.js application
# Generates optimized production bundle in .next directory
RUN pnpm build


# ============================================================================
# Runtime stage - Minimal production image
# ============================================================================
FROM base as runtime

# Install production dependencies only
COPY pnpm-lock.yaml .
COPY package.json .

RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Expose port
EXPOSE 3000

# Environment variables for Next.js
ENV PORT=3000 \
    HOSTNAME=0.0.0.0

# ============================================================================
# Production startup command
# ============================================================================
# Starts the Next.js production server
# The server is optimized for production with:
# - Hot module replacement disabled
# - Compression enabled
# - Static optimization applied during build
#
# For standalone deployment, Next.js includes minimal runtime dependencies
# ============================================================================
CMD ["pnpm", "start"]
