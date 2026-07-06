FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/work-db/package.json apps/work-db/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY mcp-servers/work-db-mcp-server/package.json mcp-servers/work-db-mcp-server/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/mcp-servers/work-db-mcp-server
EXPOSE 3000
CMD ["node", "dist/index.js"]
