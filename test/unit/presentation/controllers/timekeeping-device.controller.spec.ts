import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TimekeepingDeviceController } from '../../../../src/presentation/controllers/timekeeping-device.controller';
import { TimekeepingDeviceOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/timekeeping-device.orm-entity';
import { TimekeepingLogOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/timekeeping-log.orm-entity';
import { SyncStudentToDeviceUseCase } from '../../../../src/modules/timekeeping/application/use-cases/sync-student-to-device.use-case';
import { ConfigureWebhookUseCase } from '../../../../src/modules/timekeeping/application/use-cases/configure-webhook.use-case';
import { SyncDeviceTimeUseCase } from '../../../../src/modules/timekeeping/application/use-cases/sync-device-time.use-case';
import { ReconcileTimekeepingLogsUseCase } from '../../../../src/modules/timekeeping/application/use-cases/reconcile-timekeeping-logs.use-case';
import { MinioService } from '../../../../src/infrastructure/storage/minio.service';
import { TeacherOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/teacher.orm-entity';

describe('TimekeepingDeviceController', () => {
  let controller: TimekeepingDeviceController;
  let logRepository: any;
  let minioService: any;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  const mockMinioService = {
    getPresignedUrl: jest.fn().mockResolvedValue('https://minio/attendance/mock-url.jpg'),
  };

  beforeEach(async () => {
    logRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimekeepingDeviceController],
      providers: [
        {
          provide: getRepositoryToken(TimekeepingDeviceOrmEntity),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TimekeepingLogOrmEntity),
          useValue: logRepository,
        },
        {
          provide: SyncStudentToDeviceUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ConfigureWebhookUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: SyncDeviceTimeUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ReconcileTimekeepingLogsUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: getRepositoryToken(TeacherOrmEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: MinioService,
          useValue: mockMinioService,
        },
      ],
    }).compile();

    controller = module.get<TimekeepingDeviceController>(TimekeepingDeviceController);
    minioService = module.get(MinioService);
    jest.clearAllMocks();
  });

  describe('listLogs', () => {
    it('nên thiết lập query builder mặc định khi không truyền tham số lọc', async () => {
      await controller.listLogs();

      expect(logRepository.createQueryBuilder).toHaveBeenCalledWith('log');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('log.student', 'student');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('log.eventTime', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('nên áp dụng lọc theo search khi truyền tham số search', async () => {
      await controller.listLogs(1, 20, 'Vy');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(log.employeeNo) LIKE :search'),
        { search: '%vy%' }
      );
    });

    it('nên áp dụng lọc theo khoảng ngày khi truyền startDate và endDate', async () => {
      await controller.listLogs(1, 20, undefined, undefined, '2026-08-10', '2026-08-11');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.eventTime >= :start',
        { start: new Date('2026-08-10T00:00:00+07:00') }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.eventTime <= :end',
        { end: new Date('2026-08-11T23:59:59+07:00') }
      );
    });

    it('nên áp dụng lọc theo ngày đơn làm fallback khi chỉ truyền date', async () => {
      await controller.listLogs(1, 20, undefined, '2026-08-11');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.eventTime BETWEEN :start AND :end',
        { start: new Date('2026-08-11T00:00:00+07:00'), end: new Date('2026-08-11T23:59:59+07:00') }
      );
    });

    it('nên áp dụng lọc theo hình thức xác thực khi truyền verifyMethod', async () => {
      await controller.listLogs(1, 20, undefined, undefined, undefined, undefined, 'fingerprint');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.verifyMethod = :verifyMethod',
        { verifyMethod: 'fingerprint' }
      );
    });

    it('nên áp dụng lọc theo trạng thái khớp học sinh là matched', async () => {
      await controller.listLogs(1, 20, undefined, undefined, undefined, undefined, undefined, 'matched');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.studentId IS NOT NULL');
    });

    it('nên áp dụng lọc theo trạng thái khớp học sinh là unmatched', async () => {
      await controller.listLogs(1, 20, undefined, undefined, undefined, undefined, undefined, 'unmatched');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.studentId IS NULL');
    });
  });
});
