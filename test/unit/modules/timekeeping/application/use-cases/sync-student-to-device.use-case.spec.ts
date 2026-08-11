import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncStudentToDeviceUseCase } from '../../../../../../src/modules/timekeeping/application/use-cases/sync-student-to-device.use-case';
import { StudentOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/student.orm-entity';

describe('SyncStudentToDeviceUseCase', () => {
  let useCase: SyncStudentToDeviceUseCase;
  let studentRepository: Repository<StudentOrmEntity>;

  beforeEach(async () => {
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
      ],
    }).compile();

    useCase = module.get<SyncStudentToDeviceUseCase>(SyncStudentToDeviceUseCase);
    studentRepository = module.get<Repository<StudentOrmEntity>>(getRepositoryToken(StudentOrmEntity));
  });

  it('nên chuyển đổi (toggle) trạng thái đồng bộ khi không truyền status', async () => {
    // Arrange
    const mockStudent = {
      id: 'student-uuid-123',
      studentId: 'HV-2026-007',
      isSyncedToDevice: false,
    } as StudentOrmEntity;

    jest.spyOn(studentRepository, 'findOne').mockResolvedValue(mockStudent);
    jest.spyOn(studentRepository, 'save').mockImplementation(async (student: any) => student);

    // Act
    const result = await useCase.execute('student-uuid-123');

    // Assert
    expect(result).toBe(true);
    expect(mockStudent.isSyncedToDevice).toBe(true);
    expect(studentRepository.save).toHaveBeenCalledWith(mockStudent);
  });

  it('nên thiết lập trạng thái đồng bộ theo giá trị status truyền vào', async () => {
    // Arrange
    const mockStudent = {
      id: 'student-uuid-123',
      studentId: 'HV-2026-007',
      isSyncedToDevice: true,
    } as StudentOrmEntity;

    jest.spyOn(studentRepository, 'findOne').mockResolvedValue(mockStudent);
    jest.spyOn(studentRepository, 'save').mockImplementation(async (student: any) => student);

    // Act
    const result = await useCase.execute('student-uuid-123', false);

    // Assert
    expect(result).toBe(false);
    expect(mockStudent.isSyncedToDevice).toBe(false);
    expect(studentRepository.save).toHaveBeenCalledWith(mockStudent);
  });
});
