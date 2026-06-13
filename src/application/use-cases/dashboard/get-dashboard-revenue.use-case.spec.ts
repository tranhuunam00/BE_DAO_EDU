import { GetDashboardRevenueUseCase } from './get-dashboard-revenue.use-case';
import { Repository } from 'typeorm';

describe('GetDashboardRevenueUseCase', () => {
  let useCase: GetDashboardRevenueUseCase;
  let billRepo: jest.Mocked<Repository<any>>;

  beforeEach(() => {
    billRepo = { find: jest.fn() } as any;
    useCase = new GetDashboardRevenueUseCase(billRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return dummy data if no bills are found', async () => {
    billRepo.find.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.revenue).toHaveLength(5);
    expect(result.revenue[0].month).toBe('2026-01');
    expect(result.revenue[0].expected).toBe(5000000);
  });

  it('should group bills by month and calculate expected vs actual revenue', async () => {
    billRepo.find.mockResolvedValue([
      { month: '2026-02', totalAmount: 10000, status: 'Paid' },
      { month: '2026-02', totalAmount: 5000, status: 'Unpaid' },
      { month: '2026-01', totalAmount: 20000, status: 'Paid' },
      { month: '2026-01', totalAmount: 5000, status: 'Paid' },
    ]);

    const result = await useCase.execute();

    expect(result.revenue).toHaveLength(2);
    
    // Should be sorted by month ascending
    expect(result.revenue[0].month).toBe('2026-01');
    expect(result.revenue[0].expected).toBe(25000); // 20000 + 5000
    expect(result.revenue[0].actual).toBe(25000);   // Both are paid
    
    expect(result.revenue[1].month).toBe('2026-02');
    expect(result.revenue[1].expected).toBe(15000); // 10000 + 5000
    expect(result.revenue[1].actual).toBe(10000);   // Only 10000 is paid
  });

  it('should skip bills without month or parse string amounts correctly', async () => {
    billRepo.find.mockResolvedValue([
      { month: null, totalAmount: 10000, status: 'Paid' },
      { month: '2026-03', totalAmount: '15000.5', status: 'Unpaid' },
    ]);

    const result = await useCase.execute();

    expect(result.revenue).toHaveLength(1);
    expect(result.revenue[0].month).toBe('2026-03');
    expect(result.revenue[0].expected).toBe(15000.5);
    expect(result.revenue[0].actual).toBe(0);
  });
});
