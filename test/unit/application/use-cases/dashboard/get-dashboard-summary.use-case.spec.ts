import { GetDashboardSummaryUseCase } from '../../../../../src/application/use-cases/dashboard/get-dashboard-summary.use-case';
import { Repository } from 'typeorm';

describe('GetDashboardSummaryUseCase', () => {
  let useCase: GetDashboardSummaryUseCase;
  let studentRepo: jest.Mocked<Repository<any>>;
  let teacherRepo: jest.Mocked<Repository<any>>;
  let classRepo: jest.Mocked<Repository<any>>;
  let courseRepo: jest.Mocked<Repository<any>>;
  let centerRepo: jest.Mocked<Repository<any>>;

  beforeEach(() => {
    studentRepo = { 
      count: jest.fn(),
      query: jest.fn(),
    } as any;
    teacherRepo = { count: jest.fn() } as any;
    classRepo = { count: jest.fn() } as any;
    courseRepo = { count: jest.fn() } as any;
    centerRepo = { count: jest.fn() } as any;

    useCase = new GetDashboardSummaryUseCase(
      studentRepo,
      teacherRepo,
      classRepo,
      courseRepo,
      centerRepo,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return correct statistics based on repository counts', async () => {
    studentRepo.count.mockResolvedValue(100);
    teacherRepo.count.mockResolvedValue(20);
    classRepo.count.mockResolvedValue(15);
    courseRepo.count.mockResolvedValue(5);
    centerRepo.count.mockResolvedValue(2);

    studentRepo.query.mockImplementation((queryStr: string) => {
      if (queryStr.includes('created_at < $1')) {
        return Promise.resolve([{ count: 10 }]);
      }
      if (queryStr.includes('created_at >= $1')) {
        return Promise.resolve([
          { month: '2026-06', count: 5 },
          { month: '2026-07', count: 8 },
        ]);
      }
      if (queryStr.includes('FROM courses c')) {
        return Promise.resolve([
          { name: 'Python', value: 12 },
          { name: 'Math', value: 15 },
        ]);
      }
      if (queryStr.includes('FROM teacher_monthly_wages')) {
        return Promise.resolve([{ total: 5000000 }]);
      }
      if (queryStr.includes('FROM student_monthly_bills')) {
        return Promise.resolve([{ total: 10000000 }]);
      }
      return Promise.resolve([]);
    });

    const result = await useCase.execute();

    expect(result.message).toBe('Lấy thống kê hệ thống thành công');
    expect(result.statistics.totalStudents).toBe(100);
    expect(result.statistics.totalTeachers).toBe(20);
    expect(result.statistics.totalClasses).toBe(15);
    expect(result.statistics.totalCourses).toBe(5);
    expect(result.statistics.totalCenters).toBe(2);
    expect(result.statistics.totalPaidSalary).toBe(5000000);
    expect(result.statistics.totalCollectedTuition).toBe(10000000);
    expect(result.statistics.systemStatus).toBe('Hoạt động ổn định');
    
    expect(studentRepo.count).toHaveBeenCalled();
    expect(teacherRepo.count).toHaveBeenCalled();
    expect(classRepo.count).toHaveBeenCalled();
    expect(courseRepo.count).toHaveBeenCalled();
    expect(centerRepo.count).toHaveBeenCalled();
  });

  it('should handle zero counts correctly', async () => {
    studentRepo.count.mockResolvedValue(0);
    teacherRepo.count.mockResolvedValue(0);
    classRepo.count.mockResolvedValue(0);
    courseRepo.count.mockResolvedValue(0);
    centerRepo.count.mockResolvedValue(0);

    studentRepo.query.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.statistics.totalStudents).toBe(0);
  });
});
