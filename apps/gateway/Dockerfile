# 阶段 1：Prune (提取网关及其关联代码)
FROM node:22-alpine AS pruner
WORKDIR /app
# 安装 turbo cli
RUN npm install -g turbo
COPY . .
# 剥离出仅 gateway 及其 workspace 依赖所需的文件
RUN turbo prune gateway --docker

# 阶段 2：Builder (利用缓存装包和编译)
FROM node:22-alpine AS builder
WORKDIR /app
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# 全局关闭 pnpm 新包发布时间限制（解决 Turbo 的相关报错），以及自动同步机制
RUN echo "minimum-release-age=0" >> .npmrc

# 首先只拷贝 package.json 和 lockfile 进行依赖安装，完美利用 Docker 缓存层
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# 安装依赖
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --config.minimum-release-age=0

# 拷贝源代码
COPY --from=pruner /app/out/full/ .

# Prisma 生成（需要源文件中的 schema）
RUN cd apps/gateway && ./node_modules/.bin/prisma generate

# 使用 Turbo 进行构建（只会精准构建 gateway 及其涉及的依赖包）
RUN npx turbo run build --filter=gateway

# 阶段 3：Runner (生产运行环境)
FROM node:22-alpine AS runner
WORKDIR /app
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable
ENV NODE_ENV=production

# 全局关闭 pnpm 新包发布时间限制
RUN echo "minimum-release-age=0" >> .npmrc

# 从 builder 中拷贝所有编译后的产物
COPY --from=builder /app ./

# 【核心瘦身操作】遵循 pnpm 官方针对 Monorepo 的指引：
# 1. 递归删除项目中所有的 node_modules 目录（此时只剩下被 prune 过的包）
RUN find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
# 2. 仅安装生产依赖
RUN pnpm install --prod --frozen-lockfile --config.minimum-release-age=0
# 3. 由于重建了依赖，需要重新生成一次 Prisma Client
RUN cd apps/gateway && ./node_modules/.bin/prisma generate

EXPOSE 3000

# 启动命令
CMD ["sh", "-c", "cd apps/gateway && ./node_modules/.bin/prisma db push --accept-data-loss --schema prisma/schema.prisma && node dist/apps/gateway/src/main"]
