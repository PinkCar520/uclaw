#!/bin/bash

# Ocean MCP 快速更新脚本
# 用途：日常代码更新（不停止数据库等其他服务）

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}   Ocean MCP 快速更新${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 1. 拉取最新代码
log_info "拉取最新代码..."
git pull origin main || {
    log_error "代码拉取失败，请检查网络连接"
    exit 1
}
log_success "代码更新完成"
echo ""

# 2. 仅重新构建 Gateway
log_info "重新构建 Gateway（包含 MCP Servers）..."
docker compose build gateway
log_success "Gateway 构建完成"
echo ""

# 3. 重启 Gateway（不影响其他服务）
log_info "重启 Gateway..."
docker compose up -d gateway
log_success "Gateway 已重启"
echo ""

# 4. 等待启动
log_info "等待 Gateway 启动..."
sleep 5

# 5. 验证
log_info "验证 Gateway 状态..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    log_success "Gateway 运行正常"
    echo ""
    
    # 显示 MCP Servers 状态
    log_info "MCP Servers 状态:"
    curl -s http://localhost:3000/api/mcp-servers | jq '.data[] | {id: .id, enabled: .enabled, status: .status}' 2>/dev/null || {
        echo "  无法获取详细信息，请手动检查"
    }
else
    log_warn "Gateway 可能未完全启动，请稍后检查"
    docker compose ps gateway
fi

echo ""
echo -e "${GREEN}============================${NC}"
echo -e "${GREEN}   更新完成！${NC}"
echo -e "${GREEN}============================${NC}"
echo ""
echo "查看日志: docker compose logs -f gateway"
echo "查看状态: docker compose ps"
echo ""
