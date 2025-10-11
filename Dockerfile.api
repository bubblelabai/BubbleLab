# Stage 1: Build everything except bubblelab-api with Node + pnpm
FROM node:20-slim AS builder

RUN corepack enable
WORKDIR /workspace

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc ./. 
COPY packages ./packages/
COPY apps ./apps/
COPY tools ./tools/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build bubble-core (but not bubblelab-api yet)
RUN cd packages/bubble-shared-schemas && pnpm run build
RUN cd packages/bubble-core && pnpm run build
RUN cd packages/bubble-runtime && pnpm run build

# Stage 2: Build bubblelab-api with Bun
FROM oven/bun:1.1.38-debian AS runtime

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace from builder
COPY --from=builder /workspace ./

# Install Python requirements
RUN pip3 install -r packages/bubble-core/scripts/requirements.txt

# Accept DATABASE_URL at build time and expose it to subsequent steps
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
ENV PYTHON_PATH=/usr/bin/python3

# Reinstall dependencies for correct architecture (skip postinstall scripts)
RUN bun install --frozen-lockfile --ignore-scripts

# Set working directory to API
WORKDIR /app/apps/bubblelab-api


# Create data directory
RUN mkdir -p data


EXPOSE 3001
# Generate schema and run migrations at startup, then start the app
CMD ["sh", "-c", "bun run src/index.ts"]