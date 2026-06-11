import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitLabTool } from '../src/index';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('GitLabTool', () => {
  let gitlab: GitLabTool;
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);
    
    gitlab = new GitLabTool({
      baseUrl: 'https://gitlab.example.com',
      token: 'test-token',
    });
  });

  describe('listProjects', () => {
    it('should return projects when API succeeds', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'ocean',
            path_with_namespace: 'ocean/ocean',
            description: 'Ocean main repo',
            web_url: 'https://gitlab.example.com/ocean/ocean',
            default_branch: 'main',
            visibility: 'private',
          },
        ],
        headers: {},
      });

      const projects = await gitlab.listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('ocean');
      // fetchAll will call with page=1, per_page=100
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v4/projects', expect.objectContaining({
        params: expect.objectContaining({ page: 1, per_page: 100 })
      }));
    });
  });

  describe('listMRs', () => {
    it('should return merge requests', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [
          {
            id: 101,
            iid: 45,
            project_id: 1,
            title: 'feat: add feature',
            source_branch: 'feature/branch',
            target_branch: 'main',
            state: 'opened',
            web_url: 'https://gitlab.example.com/-/merge_requests/45',
          },
        ],
        headers: {},
      });

      const mrs = await gitlab.listMRs(1);
      expect(mrs).toHaveLength(1);
      expect(mrs[0].title).toBe('feat: add feature');
    });
  });

  describe('createProject', () => {
    it('should create project successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: 2,
          name: 'new-project',
          path_with_namespace: 'ocean/new-project',
          web_url: 'https://gitlab.example.com/ocean/new-project',
          default_branch: 'main',
          visibility: 'private',
        }
      });

      const project = await gitlab.createProject({ name: 'new-project' });
      expect(project.name).toBe('new-project');
      expect(project.id).toBe(2);
    });
  });

  describe('getFileRaw', () => {
    it('should return file content', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: 'file content'
      });

      const content = await gitlab.getFileRaw(1, 'src/index.ts', 'main');
      expect(content).toBe('file content');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v4/projects/1/repository/files/src%2Findex.ts/raw',
        expect.objectContaining({ params: { ref: 'main' } })
      );
    });
  });

  describe('mergeMR', () => {
    it('should call merge API', async () => {
      mockAxiosInstance.put.mockResolvedValue({ data: {} });

      await gitlab.mergeMR(1, 45, 'Merge message');
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/api/v4/projects/1/merge_requests/45/merge',
        { merge_commit_message: 'Merge message' }
      );
    });
  });
});
