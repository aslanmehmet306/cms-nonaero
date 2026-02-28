# Stage: base
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Stage: development
FROM base AS development
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json ./
COPY .npmrc ./

# Copy package manifests for all workspace packages
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/formula-engine/package.json packages/formula-engine/
COPY packages/tsconfig/ packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY packages/ packages/
COPY apps/api/ apps/api/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build the API
RUN pnpm --filter @airport-revenue/api build

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
