import { AcademicError } from '../../domain/errors/academic.error';
import { TypeOrmAcademicsPersistenceAdapter } from './typeorm-academics-persistence.adapter';

describe('TypeOrmAcademicsPersistenceAdapter transactions', () => {
  const createManager = () => {
    const enrollmentRepo = {
      findOne: jest.fn(),
      count: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'enrollment-1', ...value })),
    };
    const attendanceRepo = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    const sessionQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const manager = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(async (value) => value),
      getRepository: jest.fn((entity) => {
        if (String(entity).includes('ClassStudent')) return enrollmentRepo;
        if (String(entity).includes('StudentAttendance')) return attendanceRepo;
        return { createQueryBuilder: jest.fn(() => sessionQuery) };
      }),
      createQueryBuilder: jest.fn(),
    };
    return { manager, enrollmentRepo };
  };

  it('uses SERIALIZABLE and pessimistic locks for enrollment capacity', async () => {
    const { manager, enrollmentRepo } = createManager();
    manager.findOne
      .mockResolvedValueOnce({ id: 'class-1', maxSize: 1 })
      .mockResolvedValueOnce({ id: 'student-1', status: 'Waiting for class' });
    enrollmentRepo.findOne.mockResolvedValue(null);
    enrollmentRepo.count.mockResolvedValue(1);
    const dataSource = {
      transaction: jest.fn(
        async (_isolation: string, work: (value: typeof manager) => unknown) =>
          work(manager),
      ),
    };
    const adapter = new TypeOrmAcademicsPersistenceAdapter(dataSource as any);

    await expect(
      adapter.enrollStudent('class-1', 'student-1', '2026-06-14'),
    ).rejects.toMatchObject<Partial<AcademicError>>({ code: 'CLASS_FULL' });

    expect(dataSource.transaction).toHaveBeenCalledWith(
      'SERIALIZABLE',
      expect.any(Function),
    );
    expect(manager.findOne).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(enrollmentRepo.save).not.toHaveBeenCalled();
  });

  it('retries a serialization failure', async () => {
    const { manager, enrollmentRepo } = createManager();
    manager.findOne
      .mockResolvedValueOnce({ id: 'class-1', maxSize: null })
      .mockResolvedValueOnce({ id: 'student-1', status: 'Waiting for class' });
    enrollmentRepo.findOne.mockResolvedValue({
      id: 'enrollment-1',
      classId: 'class-1',
      studentId: 'student-1',
      status: 'Active',
      joinedDate: '2026-06-01',
    });
    const dataSource = {
      transaction: jest
        .fn()
        .mockRejectedValueOnce({ code: '40001' })
        .mockImplementationOnce(
          async (
            _isolation: string,
            work: (value: typeof manager) => unknown,
          ) => work(manager),
        ),
    };
    const adapter = new TypeOrmAcademicsPersistenceAdapter(dataSource as any);

    await adapter.enrollStudent('class-1', 'student-1', '2026-06-14');

    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
  });
});
