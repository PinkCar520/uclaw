import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JenkinsTool } from '../src/index';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('JenkinsTool', () => {
  let jenkins: JenkinsTool;
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);
    
    jenkins = new JenkinsTool({
      baseUrl: 'https://jenkins.example.com',
      token: 'test-token',
      username: 'admin',
    });
  });

  describe('listJobs', () => {
    it('should return jobs when API succeeds', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          jobs: [
            {
              name: 'gateway-build',
              fullName: 'ocean/gateway-build',
              url: 'https://jenkins.example.com/job/gateway-build',
              description: 'Gateway build job',
              color: 'blue',
              lastBuild: {
                number: 123,
                id: '123',
                timestamp: 1712995200000,
                duration: 180000,
                result: 'SUCCESS',
                url: 'https://jenkins.example.com/job/gateway-build/123',
              },
            },
          ],
        },
      });

      const jobs = await jenkins.listJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].name).toBe('gateway-build');
      expect(jobs[0].lastBuild?.status).toBe('success');
      expect(jobs[0].lastBuild?.number).toBe(123);
    });

    it('should return empty array when API fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const jobs = await jenkins.listJobs();
      expect(jobs).toEqual([]);
    });
  });

  describe('getJobInfo', () => {
    it('should return job details', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          name: 'test-job',
          fullName: 'ocean/test-job',
          url: 'https://jenkins.example.com/job/test-job',
          description: 'Test job',
          color: 'blue',
        },
      });

      const job = await jenkins.getJobInfo('test-job');
      expect(job?.name).toBe('test-job');
      expect(job?.description).toBe('Test job');
    });

    it('should return null for non-existent job', async () => {
      mockAxiosInstance.get.mockRejectedValue({ response: { status: 404 } });

      const job = await jenkins.getJobInfo('non-existent');
      expect(job).toBeNull();
    });
  });

  describe('getBuildStatus', () => {
    it('should return build status', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          number: 123,
          id: '123',
          timestamp: 1712995200000,
          duration: 180000,
          result: 'SUCCESS',
          url: 'https://jenkins.example.com/job/test/123',
        },
      });

      const build = await jenkins.getBuildStatus('test-job', 123);
      expect(build?.status).toBe('success');
      expect(build?.number).toBe(123);
    });

    it('should map different result statuses', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { number: 1, id: '1', timestamp: 0, result: 'FAILURE', url: '' },
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { number: 2, id: '2', timestamp: 0, result: 'ABORTED', url: '' },
      });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { number: 3, id: '3', timestamp: 0, result: null, url: '' },
      });

      const build1 = await jenkins.getBuildStatus('test', 1);
      const build2 = await jenkins.getBuildStatus('test', 2);
      const build3 = await jenkins.getBuildStatus('test', 3);

      expect(build1?.status).toBe('failure');
      expect(build2?.status).toBe('aborted');
      expect(build3?.status).toBe('running');
    });
  });

  describe('triggerBuild', () => {
    it('should trigger build successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        status: 201,
        headers: { location: 'https://jenkins.example.com/queue/item/123/' },
      });

      const result = await jenkins.triggerBuild('test-job');
      expect(result.success).toBe(true);
      expect(result.queueUrl).toBe('https://jenkins.example.com/queue/item/123/');
    });

    it('should trigger build with parameters', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        status: 201,
        headers: { location: 'https://jenkins.example.com/queue/item/456/' },
      });

      const result = await jenkins.triggerBuild('test-job', { ENV: 'staging' });
      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/job/test-job/buildWithParameters',
        { ENV: 'staging' },
        expect.any(Object)
      );
    });

    it('should return false on failure', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Unauthorized'));

      const result = await jenkins.triggerBuild('test-job');
      expect(result.success).toBe(false);
    });
  });

  describe('getBuildLog', () => {
    it('should return build log', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: 'Starting build...\nChecking out code...\nBuild successful!',
      });

      const log = await jenkins.getBuildLog('test-job', 123);
      expect(log).toContain('Build successful!');
    });

    it('should return empty string on failure', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Not found'));

      const log = await jenkins.getBuildLog('test-job', 999);
      expect(log).toBe('');
    });
  });

  describe('approveDeployment', () => {
    it('should approve deployment', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      const result = await jenkins.approveDeployment(123, true, 'Looks good');
      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('No input found'));

      const result = await jenkins.approveDeployment(123, true);
      expect(result).toBe(false);
    });
  });
});
