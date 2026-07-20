import { GetDashboardRevenueUseCase } from '../../../../../src/application/use-cases/dashboard/get-dashboard-revenue.use-case';
import { Repository } from 'typeorm';

describe('GetDashboardRevenueUseCase', () => {
  let useCase: GetDashboardRevenueUseCase;
  let billRepo: jest.Mocked<Repository<any>>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-09T12:00:00Z'));
    billRepo = { find: jest.fn() } as any;
    useCase = new GetDashboardRevenueUseCase(billRepo);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should return empty values for all 6 months if no bills are found', async () => {
    billRepo.find.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.revenue).toHaveLength(6);
    expect(result.revenue[0].month).toBe('2026-02');
    expect(result.revenue[0].expected).toBe(0);
    expect(result.revenue[0].actual).toBe(0);
    expect(result.revenue[5].month).toBe('2026-07');
  });

  it('should group bills by month and calculate expected vs actual revenue', async () => {
    billRepo.find.mockResolvedValue([
      { month: '2026-03', totalAmount: 10000, status: 'Paid' },
      { month: '2026-03', totalAmount: 5000, status: 'Unpaid' },
      { month: '2026-02', totalAmount: 20000, status: 'Paid' },
      { month: '2026-02', totalAmount: 5000, status: 'Paid' },
    ]);

    const result = await useCase.execute();

    expect(result.revenue).toHaveLength(6);
    
    // 2026-02 (index 0)
    expect(result.revenue[0].month).toBe('2026-02');
    expect(result.revenue[0].expected).toBe(25000); // 20000 + 5000
    expect(result.revenue[0].actual).toBe(25000);   // Both are paid
    
    // 2026-03 (index 1)
    expect(result.revenue[1].month).toBe('2026-03');
    expect(result.revenue[1].expected).toBe(15000); // 10000 + 5000
    expect(result.revenue[1].actual).toBe(10000);   // Only 10000 is paid
    
    // Other months should be 0
    expect(result.revenue[2].month).toBe('2026-04');
    expect(result.revenue[2].expected).toBe(0);
  });

  it('should skip bills without month or parse string amounts correctly', async () => {
    billRepo.find.mockResolvedValue([
      { month: null, totalAmount: 10000, status: 'Paid' },
      { month: '2026-03', totalAmount: '15000.5', status: 'Unpaid' },
    ]);

    const result = await useCase.execute();

    expect(result.revenue).toHaveLength(6);
    const marRecord = result.revenue.find(r => r.month === '2026-03');
    expect(marRecord).toBeDefined();
    expect(marRecord?.expected).toBe(15000.5);
    expect(marRecord?.actual).toBe(0);
  });
});
