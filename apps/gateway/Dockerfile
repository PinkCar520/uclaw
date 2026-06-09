# 第一阶段：编译构建
FROM node:22-alpine AS builder

WORKDIR /app
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# 1. 拷贝根配置
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# 2. 仅拷贝所有 package.json 来安装依赖 (利用缓存)
COPY apps/gateway/package.json apps/gateway/
COPY agent/mcp/mcp-im/package.json agent/mcp/mcp-im/
COPY agent/mcp/mcp-zentao/package.json agent/mcp/mcp-zentao/
COPY agent/mcp/mcp-jenkins/package.json agent/mcp/mcp-jenkins/
COPY agent/mcp/mcp-gitlab/package.json agent/mcp/mcp-gitlab/
COPY packages/shared/core/package.json packages/shared/core/
COPY packages/tools/zentao/package.json packages/tools/zentao/
COPY agent/skills/package.json agent/skills/
COPY packages/shared/sandbox/package.json packages/shared/sandbox/

# 安装全量依赖 (使用缓存挂载加速)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

# 3. 拷贝源码并生成 Prisma Client
COPY apps/gateway/prisma apps/gateway/prisma
COPY apps/gateway/prisma.config.js apps/gateway/prisma.config.js
RUN cd apps/gateway && ./node_modules/.bin/prisma generate

# 拷贝其余所有源码
COPY . .

# 编译各个模块
RUN pnpm --filter @uclaw/core build
RUN pnpm --filter @uclaw/tools-zentao build
RUN pnpm --filter @uclaw/mcp-zentao build
RUN pnpm --filter @uclaw/mcp-jenkins build
RUN pnpm --filter @uclaw/mcp-gitlab build
RUN pnpm --filter @uclaw/mcp-im build
RUN pnpm --filter gateway build

# 第二阶段：生产运行
FROM node:22-alpine AS runner
WORKDIR /app
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable

ENV NODE_ENV=production

# 拷贝运行时所需的 workspace 元数据与已安装依赖
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/gateway/package.json apps/gateway/
COPY apps/gateway/prisma apps/gateway/prisma
COPY apps/gateway/prisma.config.js apps/gateway/prisma.config.js
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gateway/node_modules ./apps/gateway/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/agent/mcp ./agent/mcp
COPY --from=builder /app/agent/skills ./agent/skills

# 拷贝编译后的产物
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist

# 拷贝运行时需要的非编译文件
COPY apps/gateway/mcp.config.json apps/gateway/mcp.config.json

EXPOSE 3000

# 启动建议：在 monorepo 模式下，nest build 的产物位于 dist/apps/gateway/src/main
CMD ["sh", "-c", "cd apps/gateway && ./node_modules/.bin/prisma db push --accept-data-loss --schema prisma/schema.prisma && node dist/apps/gateway/src/main"]
