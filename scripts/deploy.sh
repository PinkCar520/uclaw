#!/bin/bash

# Ocean MCP Docker 部署脚本
# 用途：一键构建、部署和验证

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查前置条件
check_prerequisites() {
    log_info "检查前置条件..."
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    # 检查 Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose V2"
        exit 1
    fi
    
    # 检查 .env 文件
    if [ ! -f .env ]; then
        log_warn ".env 文件不存在，从 .env.example 复制..."
        if [ -f .env.example ]; then
            cp .env.example .env
            log_warn "已从 .env.example 创建 .env，请编辑后重新运行此脚本"
            exit 1
        else
            log_error ".env.example 也不存在，无法创建 .env"
            exit 1
        fi
    fi
    
    log_success "前置条件检查通过"
}

# 停止现有服务
stop_existing_services() {
    log_info "停止现有服务..."
    docker compose down 2>/dev/null || true
    log_success "现有服务已停止"
}

# 构建所有服务
build_services() {
    log_info "构建所有服务（这可能需要几分钟）..."
    
    if [ "$1" == "--no-cache" ]; then
        docker compose build --no-cache
    else
        docker compose build
    fi
    
    log_success "服务构建完成"
}

# 启动所有服务
start_services() {
    log_info "启动所有服务..."
    docker compose up -d
    
    log_info "等待服务就绪..."
    sleep 10
    
    log_success "所有服务已启动"
}

# 验证服务状态
verify_services() {
    log_info "验证服务状态..."
    
    # 检查容器运行状态
    local running_containers=$(docker compose ps --services --filter "status=running" | wc -l)
    local total_containers=$(docker compose config --services | wc -l)
    
    if [ "$running_containers" -eq "$total_containers" ]; then
        log_success "所有 $total_containers 个服务运行正常"
    else
        log_warn "$running_containers/$total_containers 个服务运行正常"
        log_info "查看详细状态："
        docker compose ps
    fi
    
    # 等待 Gateway 完全就绪
    log_info "等待 Gateway 启动..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            log_success "Gateway 已就绪"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_warn "Gateway 可能未完全就绪，请稍后手动检查"
    fi
}

# 显示部署信息
show_deployment_info() {
    log_success "部署完成！"
    echo ""
    echo -e "${GREEN}============================${NC}"
    echo -e "${GREEN}   Ocean MCP 部署成功！${NC}"
    echo -e "${GREEN}============================${NC}"
    echo ""
    echo "服务访问地址："
    echo -e "  ${BLUE}Web 面板:${NC}      http://localhost:8081"
    echo -e "  ${BLUE}API 网关:${NC}      http://localhost:3000"
    echo -e "  ${BLUE}ZenTao:${NC}        http://localhost:8080"
    echo -e "  ${BLUE}Jenkins:${NC}       http://localhost:8082"
    echo -e "  ${BLUE}GitLab:${NC}        http://localhost:8083"
    echo -e "  ${BLUE}PostgreSQL:${NC}    localhost:5432"
    echo -e "  ${BLUE}Redis:${NC}         localhost:6379"
    echo ""
    echo "下一步："
    echo "  1. 初始化 Jenkins: http://localhost:8082"
    echo "     初始密码: docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword"
    echo ""
    echo "  2. 登录 GitLab: http://localhost:8083"
    echo "     用户: root, 密码: gitlab_admin_pass"
    echo ""
    echo "  3. 验证 MCP Servers:"
    echo "     curl http://localhost:3000/api/mcp-servers"
    echo ""
    echo "常用命令："
    echo "  查看日志:   docker compose logs -f gateway"
    echo "  重启服务:   docker compose restart"
    echo "  停止服务:   docker compose down"
    echo "  更新部署:   ./scripts/deploy.sh"
    echo ""
    echo -e "${YELLOW}详细文档: docs/deployment/DOCKER_MCP_DEPLOYMENT.md${NC}"
    echo ""
}

# 显示帮助
show_help() {
    echo "Ocean MCP Docker 部署脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --no-cache      不使用缓存重新构建"
    echo "  --stop-only     仅停止服务"
    echo "  --start-only    仅启动服务（不构建）"
    echo "  --verify        仅验证服务状态"
    echo "  --help, -h      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0              # 完整部署（使用缓存）"
    echo "  $0 --no-cache   # 完整部署（不使用缓存）"
    echo "  $0 --stop-only  # 仅停止服务"
    echo ""
}

# 主函数
main() {
    # 解析参数
    case "$1" in
        --help|-h)
            show_help
            exit 0
            ;;
        --stop-only)
            check_prerequisites
            stop_existing_services
            log_success "服务已停止"
            exit 0
            ;;
        --start-only)
            check_prerequisites
            start_services
            verify_services
            show_deployment_info
            exit 0
            ;;
        --verify)
            verify_services
            exit 0
            ;;
        --no-cache)
            check_prerequisites
            stop_existing_services
            build_services --no-cache
            start_services
            verify_services
            show_deployment_info
            exit 0
            ;;
        "")
            check_prerequisites
            stop_existing_services
            build_services
            start_services
            verify_services
            show_deployment_info
            exit 0
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
