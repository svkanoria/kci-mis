# ---- Base Stage ----
# Use the official Node.js 22 LTS image as a base.
# Alpine images are small and secure.
# GOTCHA: radix-ui modules did not resolve correctly with Node.js 24.
FROM node:22-alpine AS base
WORKDIR /app

# ---- Dependencies Stage ----
# This stage installs all npm dependencies.
# It's a separate stage to leverage Docker cache.
FROM base AS deps
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock, pnpm-lock.yaml)
COPY package.json package-lock.json* ./

# Install dependencies using 'npm ci' for clean, reproducible builds
RUN npm ci --legacy-peer-deps

# ---- Development Stage ----
# This is the target for development.
# It re-uses the 'deps' stage and runs the dev server.
FROM deps AS development
WORKDIR /app

# Copy the rest of the application code
COPY . .

# Set environment to development
ENV NODE_ENV development

# Expose port 3000
EXPOSE 3000

# Command to run the development server
CMD ["npm", "run", "dev"]


# ---- Builder Stage ----
# This stage builds the production-ready application.
FROM deps AS builder
WORKDIR /app

# Copy the rest of the application code
COPY . .

# Set environment to production
ENV NODE_ENV production

# Build arguments for Next.js build
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL
ARG NEXT_PUBLIC_AG_GRID_LICENSE
ARG NEXT_PUBLIC_SANITY_PROJECT_ID
ARG NEXT_PUBLIC_SANITY_DATASET
ARG NEXT_PUBLIC_SANITY_API_VERSION

# Build the Next.js application
RUN npm run build


# ---- Production Stage ----
# This is the final, optimized production image.
# It starts from a clean base image and copies *only* the built assets.
FROM base AS production
WORKDIR /app

# Set environment to production
ENV NODE_ENV production

# Create a non-root user for security
RUN addgroup --system --gid 1001 nextjs
RUN adduser --system --uid 1001 nextjs

# Copy built assets from the 'builder' stage
# We use the 'standalone' output for an optimized server.
# See "A Note on `next.config.mjs`" below.
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

# Switch to the non-root user
USER nextjs

# Expose port 3000
EXPOSE 3000

# Set the default command to start the standalone Next.js server
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
