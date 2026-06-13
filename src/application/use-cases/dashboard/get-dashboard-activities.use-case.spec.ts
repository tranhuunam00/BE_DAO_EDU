import { GetDashboardActivitiesUseCase } from './get-dashboard-activities.use-case';
import { Repository } from 'typeorm';

describe('GetDashboardActivitiesUseCase', () => {
  let useCase: GetDashboardActivitiesUseCase;
  let classRepo: jest.Mocked<Repository<any>>;
  let studentRepo: jest.Mocked<Repository<any>>;

  beforeEach(() => {
    classRepo = { find: jest.fn() } as any;
    studentRepo = { find: jest.fn() } as any;

    useCase = new GetDashboardActivitiesUseCase(classRepo, studentRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and merge activities sorted by time DESC', async () => {
    const classDate = new Date('2026-06-10T10:00:00Z');
    const studentDate = new Date('2026-06-11T10:00:00Z');

    classRepo.find.mockResolvedValue([
      { id: '1', className: 'Math 101', createdAt: classDate }
    ]);
    studentRepo.find.mockResolvedValue([
      { id: '2', firstName: 'John', lastName: 'Doe', createdAt: studentDate }
    ]);

    const result = await useCase.execute();

    expect(classRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, take: 5 });
    expect(studentRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, take: 5 });

    // The student should be first because it's newer (June 11 > June 10)
    expect(result.activities).toHaveLength(2);
    expect(result.activities[0].id).toBe('student-2');
    expect(result.activities[0].action).toBe('Tiếp nhận học sinh');
    expect(result.activities[0].target).toBe('Học sinh John Doe');

    expect(result.activities[1].id).toBe('class-1');
    expect(result.activities[1].action).toBe('Tạo lớp học mới');
    expect(result.activities[1].target).toBe('Lớp Math 101');
  });

  it('should take at most 10 activities', async () => {
    // Return 6 classes and 6 students to make total 12
    const classes = Array(6).fill({ id: 'c', className: 'Class', createdAt: new Date() });
    const students = Array(6).fill({ id: 's', firstName: 'F', lastName: 'L', createdAt: new Date() });
    
    classRepo.find.mockResolvedValue(classes);
    studentRepo.find.mockResolvedValue(students);

    const result = await useCase.execute();

    expect(result.activities).toHaveLength(10);
  });
});
