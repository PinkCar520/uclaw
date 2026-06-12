# Ocean MCP Docker 部署指南

## 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                         │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ ocean-web   │  │ ocean-gw    │  │ ocean-jkns  │     │
│  │ :8081       │─▶│ :3000       │─▶│ :8082       │     │
│  └─────────────┘  └──────┬──────┘  └─────────────┘     │
│                           │                              │
│  ┌────────────────────────▼───────────────────────┐     │
│  │         MCP Servers (内置于 Gateway）           │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │     │
│  │  │ mcp-     │ │ mcp-     │ │ mcp-     │      │     │
│  │  │ zentao   │ │ jenkins  │ │ gitlab   │      │     │
│  │  └──────────┘ └──────────┘ └──────────┘      │     │
│  └───────────────────────────────────────────────┘     │
│                           │                              │
│  ┌─────────────┐  ┌──────▼──────┐  ┌─────────────┐     │
│  │ ocean-zentao│  │ ocean-pg    │  │ ocean-gitlab│     │
│  │ :8080       │  │ :5432       │  │ :8083       │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## 部署步骤

### 1. 环境变量配置

编辑 `.env` 文件，添加以下配置：

```bash
# ============ MCP Servers ============

# Jenkins CI/CD
JENKINS_BASE_URL=http://jenkins:8080
JENKINS_TOKEN=your_jenkins_token_here

# GitLab Repository
GITLAB_BASE_URL=http://gitlab:80
GITLAB_TOKEN=your_gitlab_token_here

# ZenTao (已有)
ZENTAO_BASE_URL=http://zentao:80
ZENTAO_API_TOKEN=your_zentao_token_here
```

### 2. 首次部署

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 构建所有服务（包含新增的 MCP Servers）
docker compose build --no-cache

# 3. 启动所有服务
docker compose up -d

# 4. 查看服务状态
docker compose ps
```

### 3. 验证部署

```bash
# 检查 Gateway 日志
docker compose logs -f gateway

# 检查 Jenkins 是否启动成功
docker compose logs -f jenkins

# 检查 GitLab 是否启动成功
docker compose logs -f gitlab

# 验证 MCP Servers 连接
curl http://localhost:3000/api/mcp-servers
```

---

## 服务端口映射

| 服务 | 容器端口 | 宿主机端口 | 说明 |
|------|---------|-----------|------|
| Gateway | 3000 | 3000 | API 网关 |
| Web | 80 | 8081 | 前端面板 |
| PostgreSQL | 5432 | 5432 | 数据库 |
| Redis | 6379 | 6379 | 缓存/会话 |
| ZenTao | 80 | 8080 | 禅道 |
| **Jenkins** | **8080** | **8082** | **CI/CD（新增）** |
| **GitLab** | **80** | **8083** | **代码托管（新增）** |
| GitLab SSH | 22 | 22 | Git SSH |

---

## 初始化配置

### Jenkins 初始化

1. **访问 Jenkins**: http://localhost:8082
2. **获取初始密码**:
   ```bash
   docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
3. **安装推荐插件**
4. **创建管理员账户**
5. **生成 API Token**:
   - 进入用户设置
   - 添加新 Token
   - 复制到 `.env` 文件的 `JENKINS_TOKEN`

### GitLab 初始化

1. **访问 GitLab**: http://localhost:8083
2. **初始密码**: `gitlab_admin_pass`（可在 docker-compose.yml 修改）
3. **用户**: `root`
4. **生成 Personal Access Token**:
   - User Settings → Access Tokens
   - 勾选 `api`, `read_user`, `read_repository`, `write_repository`
   - 复制到 `.env` 文件的 `GITLAB_TOKEN`

---

## 更新部署

### 日常更新（代码变更）

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 仅重新构建 Gateway（包含 MCP Servers）
docker compose build gateway

# 3. 重启 Gateway
docker compose up -d gateway

# 4. 查看日志确认启动成功
docker compose logs -f gateway
```

### 仅更新 MCP Servers（不重启其他服务）

```bash
# 1. 重新构建 Gateway
docker compose build gateway

# 2. 重启 Gateway（其他服务不受影响）
docker compose restart gateway
```

### 数据库迁移

```bash
# Gateway 启动时会自动执行 db push
# 如需手动迁移：
docker compose exec gateway sh -c "cd /app/apps/gateway && npx prisma migrate dev"
```

---

## MCP Server 配置管理

### 启用/禁用 MCP Server

编辑 `apps/gateway/mcp.config.json`：

```json
{
  "mcpServers": [
    {
      "id": "jenkins",
      "enabled": true,  // 改为 false 禁用
      "approved": true  // 改为 false 需要审批
    }
  ]
}
```

重新加载配置（无需重启容器）：

```bash
# 方式 1：通过 REST API
curl -X POST http://localhost:3000/api/mcp/config/reload

# 方式 2：重启 Gateway
docker compose restart gateway
```

### 查看 MCP Server 状态

```bash
# 查看所有 MCP Servers
curl http://localhost:3000/api/mcp-servers

# 查看健康检查
curl http://localhost:3000/api/mcp-servers/health/all
```

---

## 故障排查

### Gateway 启动失败

```bash
# 查看详细日志
docker compose logs gateway

# 常见问题：
# 1. 数据库未就绪 → 检查 postgres 状态
# 2. 端口冲突 → 修改 docker-compose.yml 端口映射
# 3. 环境变量缺失 → 检查 .env 文件
```

### MCP Server 连接失败

```bash
# 检查 MCP Server 日志
docker compose logs gateway | grep -i "mcp"

# 检查环境变量
docker compose exec gateway env | grep -E "JENKINS|GITLAB|ZENTAO"

# 手动测试连接
docker compose exec gateway node /app/agents/mcp/mcp-jenkins/dist/server.js
```

### Jenkins/GitLab 无法访问

```bash
# 检查容器状态
docker compose ps jenkins gitlab

# 检查端口占用
netstat -tulpn | grep -E '8082|8083'

# 检查防火墙规则（Mac/Linux）
sudo lsof -i :8082
sudo lsof -i :8083
```

---

## 性能优化

### 资源限制（docker-compose.yml）

```yaml
services:
  gateway:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 512M

  jenkins:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 1G

  gitlab:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G
        reservations:
          memory: 2G
```

### 日志管理

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "3"
```

### 数据备份

```bash
# 备份 PostgreSQL
docker compose exec postgres pg_dump -U postgres ocean > backup_$(date +%Y%m%d).sql

# 备份 Jenkins
docker compose cp jenkins:/var/jenkins_home ./backup/jenkins

# 备份 GitLab
docker compose exec gitlab gitlab-backup create
```

---

## 开发环境

### 本地开发（不启动 Docker）

```bash
# 1. 启动外部依赖（PostgreSQL, Redis, ZenTao）
docker compose up -d postgres redis zentao

# 2. 本地启动 Gateway
cd apps/gateway
pnpm dev

# 3. 本地启动 Web
cd apps/web
pnpm dev
```

### 混合模式（部分 Docker + 部分本地）

```bash
# 启动 Jenkins 和 GitLab（Docker）
docker compose up -d jenkins gitlab

# 本地开发 Gateway（自动热加载）
cd apps/gateway
pnpm dev
```

---

## 安全建议

### 生产环境配置

1. **修改默认密码**
   - PostgreSQL: `POSTGRES_PASSWORD`
   - GitLab: `gitlab_rails['initial_root_password']`
   - Jenkins: 初始管理员密码

2. **启用 HTTPS**
   ```yaml
   # 使用 Nginx 反向代理
   nginx:
     image: nginx:alpine
     ports:
       - "443:443"
     volumes:
       - ./nginx.conf:/etc/nginx/nginx.conf
       - ./ssl:/etc/nginx/ssl
   ```

3. **限制端口暴露**
   ```yaml
   # 仅暴露 Gateway 和 Web
   ports:
     - "3000:3000"
     - "8081:80"
   
   # 内部服务不暴露到宿主机
   jenkins:
     # ports:  # 注释掉
     #   - "8082:8080"
   ```

4. **使用 Docker Secrets**
   ```yaml
   secrets:
     jenkins_token:
       file: ./secrets/jenkins_token.txt
     gitlab_token:
       file: ./secrets/gitlab_token.txt
   ```

---

## 监控与告警

### 健康检查

```bash
# 检查所有服务
curl http://localhost:3000/api/health

# 检查 MCP Servers
curl http://localhost:3000/api/mcp-servers/health/all

# 检查 Jenkins
curl http://localhost:8082/api/json

# 检查 GitLab
curl http://localhost:8083/api/v4/projects
```

### 日志聚合

```bash
# 查看所有服务日志
docker compose logs -f

# 仅查看 Gateway 日志
docker compose logs -f gateway

# 搜索错误日志
docker compose logs gateway | grep -i error
```

---

## 总结

### 一键部署命令

```bash
# 完整部署
git pull && docker compose build && docker compose up -d

# 验证部署
docker compose ps && curl http://localhost:3000/api/mcp-servers
```

### 常用命令速查

| 命令 | 说明 |
|------|------|
| `docker compose up -d` | 启动所有服务 |
| `docker compose down` | 停止所有服务 |
| `docker compose ps` | 查看服务状态 |
| `docker compose logs -f gateway` | 查看 Gateway 日志 |
| `docker compose restart gateway` | 重启 Gateway |
| `docker compose build gateway` | 重新构建 Gateway |
| `docker compose exec gateway sh` | 进入 Gateway 容器 |

---

*Ocean - 银行内网人工智能工作流中枢*  
*Docker 部署指南 v2.0 - 2026-04-13*
