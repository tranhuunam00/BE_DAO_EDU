import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { SyncStudentToDeviceUseCase } from '../../../../../../src/modules/timekeeping/application/use-cases/sync-student-to-device.use-case';
import { StudentOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/student.orm-entity';
import { TimekeepingDeviceOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/timekeeping-device.orm-entity';
import { HikvisionIsapiClient } from '../../../../../../src/modules/timekeeping/infrastructure/external/hikvision-isapi.client';

const mockRequest = jest.fn();
jest.mock('../../../../../../src/modules/timekeeping/infrastructure/external/hikvision-isapi.client', () => {
  return {
    HikvisionIsapiClient: jest.fn().mockImplementation(() => {
      return {
        request: mockRequest,
      };
    }),
  };
});

describe('SyncStudentToDeviceUseCase', () => {
  let useCase: SyncStudentToDeviceUseCase;
  let studentRepository: Repository<StudentOrmEntity>;
  let deviceRepository: Repository<TimekeepingDeviceOrmEntity>;
  let configService: ConfigService;

  beforeEach(async () => {
    mockRequest.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncStudentToDeviceUseCase,
        {
          provide: getRepositoryToken(StudentOrmEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TimekeepingDeviceOrmEntity),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-value'),
          },
        },
      ],
    }).compile();

    useCase = module.get<SyncStudentToDeviceUseCase>(SyncStudentToDeviceUseCase);
    studentRepository = module.get<Repository<StudentOrmEntity>>(getRepositoryToken(StudentOrmEntity));
    deviceRepository = module.get<Repository<TimekeepingDeviceOrmEntity>>(getRepositoryToken(TimekeepingDeviceOrmEntity));
    configService = module.get<ConfigService>(ConfigService);
  });

  it('nên trích xuất mã học sinh dạng số và bao gồm cấu hình quyền truy cập đầy đủ trong payload', async () => {
    // Arrange
    const mockStudent = {
      id: 'student-uuid-123',
      studentId: 'HV-2026-007', // Alphanumeric with hyphens
      firstName: 'Linh',
      lastName: 'Bùi Ngọc',
      isSyncedToDevice: false,
    } as StudentOrmEntity;

    const mockDevice = {
      id: 'device-uuid-456',
      name: 'Máy chấm công 1',
      ipAddress: '192.168.1.18',
      port: 80,
      username: 'admin',
      password: 'password',
      status: 'offline',
    } as TimekeepingDeviceOrmEntity;

    jest.spyOn(studentRepository, 'findOne').mockResolvedValue(mockStudent);
    jest.spyOn(deviceRepository, 'find').mockResolvedValue([mockDevice]);
    mockRequest.mockResolvedValue({ UserInfo: { employeeNo: '2026007' } });

    // Act
    await useCase.execute('student-uuid-123');

    // Assert
    // Check that HikvisionIsapiClient was constructed correctly
    expect(HikvisionIsapiClient).toHaveBeenCalledWith('192.168.1.18:80', 'admin', 'password');

    // Check that the request payload has only digits for employeeNo and includes Access Control settings
    expect(mockRequest).toHaveBeenCalledWith(
      'PUT',
      '/ISAPI/AccessControl/UserInfo/SetUp?format=json',
      expect.objectContaining({
        UserInfo: expect.objectContaining({
          employeeNo: '2026007', // HV-2026-007 stripped of non-digits
          name: 'Bùi Ngọc Linh',
          userType: 'normal',
          Valid: expect.objectContaining({
            enable: true,
            timeType: 'local',
          }),
          belongGroup: '1',
          doorRight: '1',
          RightPlan: expect.arrayContaining([
            expect.objectContaining({
              doorNo: 1,
              planTemplateNo: '1',
            }),
          ]),
        }),
      }),
    );

    // Verify student is marked as synced
    expect(studentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'student-uuid-123',
        isSyncedToDevice: true,
      }),
    );
  });
});
