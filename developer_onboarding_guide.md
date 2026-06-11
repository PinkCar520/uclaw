# Ocean 开发者快速上手指南 🚀

欢迎加入 Ocean 研发团队！为了帮助你快速了解项目架构并顺利跑起本地开发环境，请仔细阅读本指南。

> [!NOTE]
> 本项目采用 **Monorepo** (单体仓库) 架构，使用 `pnpm` 作为包管理器。所有应用和共享包都在同一个代码库中进行管理。

---

## 1. 核心架构与技术栈 🏗️

我们的项目主要分为以下几个核心模块：

### 📁 应用目录 (`apps/`)
- **`apps/gateway` (AI 网关总线)**
  - **技术栈**: NestJS + Prisma + PostgreSQL (`pgvector`) + Redis
  - **职责**: 处理所有业务逻辑、RAG 向量检索、数据库交互以及与 LLM 的通信。
- **`apps/web` (可视化面板/Web 端)**
  - **技术栈**: React + Vite + TailwindCSS
  - **职责**: 提供云端用户的浏览器交互界面。
- **`apps/ocean-desktop` (桌面客户端)**
  - **技术栈**: Electron + Vite + React
  - **职责**: 提供 macOS/Windows 原生桌面端体验，支持本地私有知识库的高级操作。

### 📁 共享包 (`packages/`)
- **`packages/ui`**: 存放多端复用的 React 组件、Hooks (如 `useProjects`) 和 API Client (`api-client.ts`)。

---

## 2. 生产环境服务器配置 🌐

我们的云端服务器部署在 `43.139.108.187`，采用 `docker-compose` 容器化编排。

> [!IMPORTANT]
> **线上服务端口映射对照表**：
> - **Web 前端**: `http://43.139.108.187:8081` (由 Nginx 提供服务)
> - **Gateway API**: `http://43.139.108.187:3000` (桌面端和客户端会请求此接口)
> - **Jaeger (链路追踪)**: `http://43.139.108.187:16686` (用于调试 API 性能和链路)
> - **PostgreSQL & Redis**: 均在内网隔离，数据持久化挂载至宿主机 `volumes`。

**依赖的镜像组件**:
- `pgvector/pgvector:pg16` (支持 AI 向量检索)
- `redis:7-alpine` (会话与流控)
- `jaegertracing/all-in-one` (可观测性)

---

## 3. 本地开发环境快速启动 💻

### 前置准备 (Prerequisites)
1. 安装 **Node.js** (推荐 v18+ 或 v20+)
2. 安装 **pnpm** (必须): `npm install -g pnpm`
3. 确保本地或服务器上有可用的 PostgreSQL 和 Redis (可以直接用 Docker 跑一个本地数据库)。

### Step 1: 安装依赖
进入项目根目录，运行一次全量安装：
```bash
pnpm install
```

### Step 2: 环境变量配置
在启动前，你需要配置各个应用下的 `.env` 文件。一般可以从 `.env.example` 复制：
- `apps/gateway/.env`: 配置 `DATABASE_URL` (指向含有 `pgvector` 的数据库) 和 `REDIS_HOST`。
- `apps/web/.env`: 如果有需要指定的 VITE 环境变量。

### Step 3: 初始化数据库
同步数据库表结构（Prisma）：
```bash
cd apps/gateway
pnpm dlx prisma db push
# 或者 pnpm dlx prisma migrate dev (取决于团队约定)
```

### Step 4: 启动本地开发服务器
在项目根目录运行（启动所有的 Web 和 Gateway 监听）：
```bash
pnpm run dev
```
- Gateway 通常运行在 `http://localhost:3000`
- Web 通常运行在 `http://localhost:5173`

---

## 4. Mac 客户端 (Electron) 开发与打包 🍎

客户端代码位于 `apps/ocean-desktop`。它通过 `packages/ui/src/lib/api-client.ts` 与云端 Gateway 进行通信。

### 本地开发调试
你可以单独开启桌面端的热更新调试：
```bash
cd apps/ocean-desktop
pnpm run dev
```

### 打包 Mac 应用程序
当你需要发布新的 `.dmg` 或 `.app` 安装包时，受限于国内网络环境，请**务必使用带镜像的构建命令**：

```bash
# 在项目根目录或 ocean 目录执行：
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/" pnpm run build:mac
```

> [!WARNING]
> **代码签名说明 (Code Signing)**
> macOS 对应用程序有严格的安全签名机制。在执行打包命令的最后阶段，系统可能（且通常会）弹窗要求输入**开机密码**或**验证指纹**以允许 `codesign` 访问 Keychain。**切勿在无交互的后台脚本中直接执行此操作，否则会报 `errSecInternalComponent` 错误。**

---

## 5. 常见问题排查 (FAQ) 🚑

- **Q: 为什么打开聊天页面，网络请求一直在疯狂刷新报错 304？**
  - **A**: 之前在 `Sidebar` 和 `useProjects` 中存在 Hooks 闭包导致的无限重渲染循环。该问题已通过 `useCallback` 修复。如遇类似页面死循环，请首要排查 `useEffect` 依赖项的引用地址是否发生突变。

- **Q: 桌面端打不开，或者调不通后端接口？**
  - **A**: 检查 `packages/ui/src/lib/api-client.ts`。生产环境下桌面端的 API base URL 可以通过 `localStorage.getItem('ocean_desktop_api_base')` 覆盖，默认为 `http://43.139.108.187:3000`。如果是本地开发调试，请在终端控制台或代码中切回 `http://127.0.0.1:3000`。

- **Q: 数据库提示 `type "vector" does not exist`？**
  - **A**: 这是因为你的 PostgreSQL 没有安装 `pgvector` 扩展。你可以连接进数据库后，手动执行 SQL：`CREATE EXTENSION IF NOT EXISTS vector;`。

---
*Keep Coding, Keep Shipping!* 🚢
