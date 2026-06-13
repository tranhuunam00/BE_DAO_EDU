import { GetDashboardSummaryUseCase } from './get-dashboard-summary.use-case';
import { Repository } from 'typeorm';

describe('GetDashboardSummaryUseCase', () => {
  let useCase: GetDashboardSummaryUseCase;
  let studentRepo: jest.Mocked<Repository<any>>;
  let teacherRepo: jest.Mocked<Repository<any>>;
  let classRepo: jest.Mocked<Repository<any>>;
  let courseRepo: jest.Mocked<Repository<any>>;
  let centerRepo: jest.Mocked<Repository<any>>;

  beforeEach(() => {
    studentRepo = { count: jest.fn() } as any;
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

    const result = await useCase.execute();

    expect(result.message).toBe('Lấy thống kê hệ thống thành công');
    expect(result.statistics.totalStudents).toBe(100);
    expect(result.statistics.totalTeachers).toBe(20);
    expect(result.statistics.totalClasses).toBe(15);
    expect(result.statistics.totalCourses).toBe(5);
    expect(result.statistics.totalCenters).toBe(2);
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

    const result = await useCase.execute();

    expect(result.statistics.totalStudents).toBe(0);
  });
});
