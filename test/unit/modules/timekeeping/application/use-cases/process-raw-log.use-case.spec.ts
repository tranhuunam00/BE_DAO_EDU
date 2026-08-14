import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Between } from 'typeorm';
import { performance } from 'perf_hooks';
import { ProcessRawLogUseCase } from '../../../../../../src/modules/timekeeping/application/use-cases/process-raw-log.use-case';
import { StudentOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/student.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { TimekeepingLogOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/timekeeping-log.orm-entity';
import { ClassSessionOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { TeacherOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/teacher.orm-entity';

describe('ProcessRawLogUseCase', () => {
  let useCase: ProcessRawLogUseCase;
  let studentRepository: any;
  let studentAttendanceRepository: any;
  let timekeepingLogRepository: any;
  let teacherRepository: any;
  let dataSource: any;

  const mockStudent = {
    id: 'student-uuid-123',
    studentId: 'HV-2026-007',
    firstName: 'Linh',
    lastName: 'Bùi Ngọc',
  } as StudentOrmEntity;

  const mockTeacher = {
    id: 'teacher-uuid-456',
    teacherId: 'GV-2026-001',
    firstName: 'Thành',
    lastName: 'Nguyễn Văn',
  } as TeacherOrmEntity;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(mockStudent),
  };

  const mockTeacherQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(mockTeacher),
  };

  const mockInsertQueryBuilder = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };

  const mockSessionQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([
      {
        id: 'session-uuid-111',
        className: 'Lớp Tiếng Anh A1',
        startTime: '08:00:00',
        endTime: '10:00:00',
        date: '2026-08-11',
      },
    ]),
  };

  beforeEach(async () => {
    studentRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn(),
    };

    studentAttendanceRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v) => v),
      save: jest.fn().mockImplementation(async (v) => ({ id: 'attendance-1', ...v })),
    };

    timekeepingLogRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockInsertQueryBuilder),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (v) => v),
    };

    teacherRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockTeacherQueryBuilder),
      findOne: jest.fn().mockResolvedValue(mockTeacher),
    };

    dataSource = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockSessionQueryBuilder),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessRawLogUseCase,
        {
          provide: getRepositoryToken(StudentOrmEntity),
          useValue: studentRepository,
        },
        {
          provide: getRepositoryToken(StudentAttendanceOrmEntity),
          useValue: studentAttendanceRepository,
        },
        {
          provide: getRepositoryToken(TimekeepingLogOrmEntity),
          useValue: timekeepingLogRepository,
        },
        {
          provide: getRepositoryToken(TeacherOrmEntity),
          useValue: teacherRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    useCase = module.get<ProcessRawLogUseCase>(ProcessRawLogUseCase);
  });

  it('nên tìm được học sinh mang mã HV-2026-007 từ mã số 2026007 gửi từ thiết bị', async () => {
    // Arrange
    const eventTime = new Date('2026-08-11T08:05:00+07:00');
    const verifyMethod = 'face';

    // Act
    await useCase.execute('2026007', eventTime, verifyMethod, {});

    // Assert
    expect(studentRepository.createQueryBuilder).toHaveBeenCalledWith('student');
    expect(mockQueryBuilder.where).toHaveBeenCalledWith(
      "LTRIM(REGEXP_REPLACE(student.studentId, '[^0-9]', '', 'g'), '0') = :code",
      { code: '2026007' }
    );
    expect(studentAttendanceRepository.save).toHaveBeenCalled();
  });

  it('nên tìm được học sinh mang mã HV-2026-007 khi mã quẹt có tiền tố 1111 và lưu log với mã có tiền tố', async () => {
    // Arrange
    const eventTime = new Date('2026-08-11T08:05:00+07:00');
    const verifyMethod = 'face';
    jest.spyOn(mockInsertQueryBuilder, 'values').mockClear();

    // Act
    await useCase.execute('11112026007', eventTime, verifyMethod, {});

    // Assert
    expect(studentRepository.createQueryBuilder).toHaveBeenCalledWith('student');
    expect(mockQueryBuilder.where).toHaveBeenCalledWith(
      "LTRIM(REGEXP_REPLACE(student.studentId, '[^0-9]', '', 'g'), '0') = :code",
      { code: '2026007' }
    );
    expect(mockInsertQueryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student-uuid-123',
        employeeNo: '11112026007',
      })
    );
  });

  it('nên lưu nhật ký thô với studentId là null và không chạy đối khớp khi không tìm thấy học sinh', async () => {
    // Arrange
    const eventTime = new Date('2026-08-11T08:05:00+07:00');
    const verifyMethod = 'face';
    jest.spyOn(mockQueryBuilder, 'getOne').mockResolvedValueOnce(null);
    jest.spyOn(mockInsertQueryBuilder, 'values').mockClear();

    // Act
    const result = await useCase.execute('9999999', eventTime, verifyMethod, {});

    // Assert
    expect(result).toEqual([]);
    expect(mockInsertQueryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: null,
        employeeNo: '9999999',
      })
    );
    expect(studentAttendanceRepository.save).not.toHaveBeenCalled();
  });

  it('nên lưu nhật ký thô kèm theo originalId lấy từ tham số truyền vào', async () => {
    // Arrange
    const eventTime = new Date('2026-08-11T08:05:00+07:00');
    const verifyMethod = 'face';
    jest.spyOn(mockInsertQueryBuilder, 'values').mockClear();

    // Act
    await useCase.execute('2026007', eventTime, verifyMethod, {}, 'evt-12345');

    // Assert
    expect(mockInsertQueryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student-uuid-123',
        employeeNo: '2026007',
        originalId: 'evt-12345',
      })
    );
  });

  it('nên tự động đối khớp và cập nhật matchedSessions cho nhật ký quẹt thẻ', async () => {
    // Arrange
    const eventTime = new Date('2026-08-11T08:05:00+07:00');
    const verifyMethod = 'face';

    const dbLog = {
      studentId: 'student-uuid-123',
      employeeNo: '2026007',
      eventTime,
      verifyMethod,
      matchedSessions: null,
    } as any;

    jest.spyOn(timekeepingLogRepository, 'find').mockResolvedValueOnce([dbLog]);

    // Act
    await useCase.execute('2026007', eventTime, verifyMethod, {});

    // Assert
    expect(timekeepingLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeNo: '2026007',
        matchedSessions: expect.arrayContaining([
          expect.objectContaining({
            className: 'Lớp Tiếng Anh A1',
            startTime: '08:00',
            endTime: '10:00',
          }),
        ]),
      })
    );
  });

  it('nên ghi nhận nhật ký của giáo viên khi mã quẹt có tiền tố 222 và không đối khớp ca học học sinh', async () => {
    // Arrange
    const eventTime = new Date('2026-08-11T08:05:00+07:00');
    const verifyMethod = 'face';
    jest.spyOn(mockInsertQueryBuilder, 'values').mockClear();

    // Act
    const result = await useCase.execute('2222026001', eventTime, verifyMethod, {});

    // Assert
    expect(result).toEqual([]);
    expect(mockInsertQueryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: null,
        teacherId: 'teacher-uuid-456',
        employeeNo: '2222026001',
      })
    );
    expect(studentAttendanceRepository.save).not.toHaveBeenCalled();
  });

  it('nên tự động đối khớp ca dạy (matchedSessions) cho giáo viên khi quẹt thẻ đúng khung giờ dạy', async () => {
    // Arrange
    const eventTime = new Date('2026-08-11T08:05:00+07:00');
    const verifyMethod = 'face';
    const teacherLog = {
      id: 'log-teacher-1',
      teacherId: 'teacher-uuid-456',
      studentId: null,
      employeeNo: '2222026001',
      eventTime,
      verifyMethod,
      matchedSessions: null,
    };

    jest.spyOn(timekeepingLogRepository, 'find').mockResolvedValueOnce([teacherLog]);
    jest.spyOn(timekeepingLogRepository, 'save').mockClear();

    // Act
    await useCase.execute('2222026001', eventTime, verifyMethod, {});

    // Assert
    expect(timekeepingLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'log-teacher-1',
        matchedSessions: expect.arrayContaining([
          expect.objectContaining({
            id: 'session-uuid-111',
            className: 'Lớp Tiếng Anh A1',
            startTime: '08:00',
            endTime: '10:00',
          }),
        ]),
      })
    );
  });

  it('nên gán matchedSessions = null cho giáo viên khi quẹt thẻ lệch ngoài khung giờ ca dạy', async () => {
    // Arrange: Quẹt lúc 23:00 (ca học từ 08:00 - 10:00)
    const eventTime = new Date('2026-08-11T23:00:00+07:00');
    const verifyMethod = 'face';
    const teacherLog = {
      id: 'log-teacher-2',
      teacherId: 'teacher-uuid-456',
      studentId: null,
      employeeNo: '2222026001',
      eventTime,
      verifyMethod,
      matchedSessions: null,
    };

    jest.spyOn(timekeepingLogRepository, 'find').mockResolvedValueOnce([teacherLog]);
    jest.spyOn(timekeepingLogRepository, 'save').mockClear();

    // Act
    await useCase.execute('2222026001', eventTime, verifyMethod, {});

    // Assert
    expect(timekeepingLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'log-teacher-2',
        matchedSessions: null,
      })
    );
  });

  it('nên ghi nhận nhật ký của giáo viên khi mã quẹt có số không đứng đầu nhưng vẫn giữ tiền tố 222', async () => {
    // Arrange
    const eventTime = new Date('2026-08-11T08:05:00+07:00');
    const verifyMethod = 'face';
    jest.spyOn(mockInsertQueryBuilder, 'values').mockClear();

    // Act
    const result = await useCase.execute('0002222026001', eventTime, verifyMethod, {});

    // Assert
    expect(result).toEqual([]);
    expect(mockInsertQueryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: null,
        teacherId: 'teacher-uuid-456',
        employeeNo: '2222026001',
      })
    );
    expect(studentAttendanceRepository.save).not.toHaveBeenCalled();
  });

  it('nên cập nhật studentId của nhật ký cũ nếu trước đó là null và hiện tại đã tìm thấy học sinh', async () => {
    // Arrange
    const eventTime = new Date('2026-08-11T08:05:00+07:00');
    const verifyMethod = 'face';

    const existingLog = {
      id: 'log-uuid-999',
      studentId: null,
      employeeNo: '2026007',
      eventTime,
      verifyMethod,
    };

    jest.spyOn(timekeepingLogRepository, 'findOne').mockResolvedValueOnce(existingLog);
    jest.spyOn(timekeepingLogRepository, 'save').mockClear();

    // Act
    await useCase.execute('2026007', eventTime, verifyMethod, {});

    // Assert
    expect(timekeepingLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'log-uuid-999',
        studentId: 'student-uuid-123',
      })
    );
  });

  it('phải hoàn thành việc xử lý nhật ký thô trong giới hạn SLA < 10ms cho 100 lần chạy (Performance Benchmark)', async () => {
    // Arrange
    const eventTime = new Date('2026-08-11T08:05:00+07:00');
    const verifyMethod = 'face';

    // Act & Benchmark
    const startTime = performance.now();
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      await useCase.execute('2026007', eventTime, verifyMethod, {});
    }
    const duration = performance.now() - startTime;
    const avgDuration = duration / iterations;

    console.log(`[Performance Benchmark] Average execution time: ${avgDuration.toFixed(2)}ms`);

    // Assert SLA: Average processing time per event < 10ms
    expect(avgDuration).toBeLessThan(10);
  });
});
