#!/bin/bash
# 测试 MCP Servers 的快速脚本
# 用法: ./test-mcp.sh [gitlab|jenkins|zentao]

set -e

SERVER=${1:-"gitlab"}
echo "=== 测试 MCP Server: $SERVER ==="

# 设置环境变量（根据实际情况修改）
export GITLAB_BASE_URL="${GITLAB_BASE_URL:-https://gitlab.example.com}"
export GITLAB_TOKEN="${GITLAB_TOKEN:-test-token}"
export JENKINS_BASE_URL="${JENKINS_BASE_URL:-https://jenkins.example.com}"
export JENKINS_TOKEN="${JENKINS_TOKEN:-test-token}"
export JENKINS_USERNAME="${JENKINS_USERNAME:-admin}"
export ZENTAO_BASE_URL="${ZENTAO_BASE_URL:-}"
export ZENTAO_API_TOKEN="${ZENTAO_API_TOKEN:-}"

# 构建服务器
echo "构建 $SERVER MCP Server..."
cd "$(dirname "$0")/../agents/mcp/mcp-$SERVER"
pnpm run build

echo ""
echo "启动 $SERVER MCP Server (Ctrl+C 退出)..."
echo "发送初始化请求..."

# 发送 MCP 初始化请求
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/server.js 2>&1 | head -20
