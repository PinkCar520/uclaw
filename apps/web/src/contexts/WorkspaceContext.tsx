import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api-client';

export type ProjectCategory = 'Engineering' | 'Finance' | 'Legal' | 'HR' | 'Operations' | 'Default';

interface ProjectInfo {
  id: string;
  name: string;
  category: ProjectCategory;
  description?: string;
  path?: string;
  branch?: string;
  isClean?: boolean;
}

interface NodeTelemetry {
  isOnline: boolean;
  currentPath: string;
  currentBranch: string;
  isClean: boolean;
  cpuUsage: number;
  ramUsage: number;
  lastAction?: string;
}

interface MCPMetric {
  id: string;
  name: string;
  label: string;
  count: number;
  status: 'online' | 'offline' | 'error';
  iconType: 'git' | 'cpu' | 'database';
}

interface WorkspaceState {
  activeProject: ProjectInfo | null;
  node: NodeTelemetry;
  mcpMetrics: MCPMetric[];
  suggestedActions: string[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  setActiveProjectId: (id: string | null) => void;
}

const DOMAIN_ACTIONS: Record<ProjectCategory, string[]> = {
  Engineering: ['Git Status', '运行单元测试', '代码质量分析', '修复待办 Bug'],
  Finance: ['自动对账', '凭证合规扫描', '生成季度报表', 'ERP 异常检测'],
  Legal: ['合同风险审查', '法律法规查新', '知识产权自检', '起草法律意见'],
  HR: ['简历批量筛选', '面试入职编排', '考勤算薪校验', '组织架构分析'],
  Operations: ['业务指标监控', '流程瓶颈分析', '分销渠道核对', '工单自动化'],
  Default: ['检查状态', '执行审计', '生成报表'],
};

const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined);

export function WorkspaceProvider({ children, token }: { children: React.ReactNode; token: string | null }) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mcpMetrics, setMcpMetrics] = useState<MCPMetric[]>([]);
  const [node, setNode] = useState<NodeTelemetry>({
    isOnline: false,
    currentPath: '等待节点连接...',
    currentBranch: '—',
    isClean: true,
    cpuUsage: 0,
    ramUsage: 0,
  });

  const suggestedActions = DOMAIN_ACTIONS[activeProject?.category || 'Default'];

  // 1. 获取项目详情
  const fetchProjectDetails = useCallback(async (id: string) => {
    try {
      const res = await api.get<any>(`/api/knowledge-projects/${id}`);
      if (res.success && res.data) {
        setActiveProject(res.data);
      } else {
        setActiveProject(null);
      }
    } catch (err) {
      console.error('Failed to fetch project details:', err);
      setActiveProject(null);
    }
  }, []);

  // 2. 获取节点遥测数据
  const fetchNodeStatus = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<any>('/api/user/node-status');
      setNode({
        isOnline: data.isOnline,
        currentPath: data.info?.cwd || '~/workspace/uwork/uclaw',
        currentBranch: data.info?.branch || 'main',
        isClean: data.info?.isClean ?? true,
        cpuUsage: data.info?.cpu || 12,
        ramUsage: data.info?.ram || 1.2,
      });
    } catch (err) {
      console.error('Failed to fetch node status:', err);
    }
  }, [token]);

  // 3. 获取 MCP 实时指标
  const fetchMCPMetrics = useCallback(async () => {
    try {
      const metrics: MCPMetric[] = [
        { id: 'gitlab', name: 'GitLab', label: '待处理 MR', count: 2, status: 'online', iconType: 'git' },
        { id: 'jenkins', name: 'Jenkins', label: '运行中流水线', count: 1, status: 'online', iconType: 'cpu' },
        { id: 'zentao', name: 'ZenTao', label: '活跃任务', count: 4, status: 'online', iconType: 'database' },
      ];
      setMcpMetrics(metrics);
    } catch (err) {
      console.error('Failed to fetch MCP metrics:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const tasks = [fetchNodeStatus(), fetchMCPMetrics()];
    if (activeProjectId) {
      tasks.push(fetchProjectDetails(activeProjectId));
    }
    await Promise.all(tasks);
    setIsLoading(false);
  }, [activeProjectId, fetchProjectDetails, fetchNodeStatus, fetchMCPMetrics]);

  // 监听项目 ID 变化并立即刷新
  useEffect(() => {
    if (activeProjectId) {
      fetchProjectDetails(activeProjectId);
    } else {
      setActiveProject(null);
    }
  }, [activeProjectId, fetchProjectDetails]);

  // 定期刷新节点和指标状态
  useEffect(() => {
    fetchNodeStatus();
    fetchMCPMetrics();
    const interval = setInterval(() => {
      fetchNodeStatus();
      fetchMCPMetrics();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchNodeStatus, fetchMCPMetrics]);

  return (
    <WorkspaceContext.Provider value={{ 
      activeProject, 
      node, 
      mcpMetrics, 
      suggestedActions,
      isLoading, 
      refresh,
      setActiveProjectId 
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
