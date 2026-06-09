# 第一阶段：编译构建
FROM node:22-alpine AS builder

WORKDIR /app
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# 拷贝根配置与所有工作区描述文件 (利用 pnpm-lock 缓存)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/gateway/package.json apps/gateway/
COPY agent/mcp/mcp-im/package.json agent/mcp/mcp-im/
COPY agent/mcp/mcp-zentao/package.json agent/mcp/mcp-zentao/
COPY agent/mcp/mcp-gitlab/package.json agent/mcp/mcp-gitlab/
COPY agent/mcp/mcp-jenkins/package.json agent/mcp/mcp-jenkins/
COPY agent/skills/package.json agent/skills/
COPY packages/shared/core/package.json packages/shared/core/
COPY packages/shared/sandbox/package.json packages/shared/sandbox/
COPY packages/tools/zentao/package.json packages/tools/zentao/

# 拷贝代码
COPY . .

# 安装全量依赖 (提供完整上下文以防 pnpm workspace 丢失链接)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

# 编译前端
RUN pnpm --filter @uclaw/core build
RUN pnpm --filter web build

# 第二阶段：生产运行
FROM nginx:stable-alpine AS runner

# 拷贝 Nginx 配置
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段拷贝产物 (Vite 默认输出到 dist)
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
