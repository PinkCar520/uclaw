import { ZentaoService } from './zentao.service';
import { ConfigService } from '@nestjs/config';

describe('ZentaoService', () => {
  let service: ZentaoService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = { get: jest.fn() } as any;
    service = new ZentaoService(configService);
    service.onModuleInit();
  });

  it('returns a bug by exact bug id', async () => {
    const bug = await service.getBugInfo('BUG-2048');

    expect(bug).not.toBeNull();
    expect(bug?.id).toBe('BUG-2048');
  });

  it('returns null for an unknown bug id', async () => {
    const bug = await service.getBugInfo('BUG-9999');

    expect(bug).toBeNull();
  });

  it('searches bugs by title keywords', async () => {
    const bugs = await service.searchBugs('safari');

    expect(bugs.some((bug) => bug.id === 'BUG-2048')).toBe(true);
  });

  it('searches bugs by status and severity fields', async () => {
    const activeBugs = await service.searchBugs('active');
    const highBugs = await service.searchBugs('high');

    expect(activeBugs.some((bug) => bug.id === 'BUG-2048')).toBe(true);
    expect(highBugs.length).toBeGreaterThan(0);
  });
});
