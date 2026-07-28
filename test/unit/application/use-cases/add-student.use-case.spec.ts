import { ConflictException } from '@nestjs/common';
import { AddStudentUseCase } from '../../../../src/application/use-cases/add-student.use-case';
import { IStudentRepository } from '../../../../src/domain/repositories/student-repository.interface';
import { IUserRepository } from '../../../../src/domain/repositories/user-repository.interface';
import { MinioService } from '../../../../src/infrastructure/storage/minio.service';
import { CreateStudentDto } from '../../../../src/application/dtos/student.dto';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AddStudentUseCase', () => {
  let useCase: AddStudentUseCase;
  let studentRepository: jest.Mocked<IStudentRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let minioService: jest.Mocked<MinioService>;

  beforeEach(() => {
    studentRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    } as any;

    userRepository = {
      save: jest.fn().mockImplementation(async (user) => {
        user.id = user.id || 'new-user-id';
        return user as any;
      }),
      findById: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findAll: jest.fn(),
      delete: jest.fn(),
    } as any;

    minioService = {
      uploadBase64Image: jest.fn(),
    } as any;

    useCase = new AddStudentUseCase(studentRepository, userRepository, minioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully add a student and always create a user account using mobile as email and password 123456', async () => {
    const dto: CreateStudentDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      mobile: '0987654321',
      gender: 'Nam',
      birthdate: '2010-01-01',
      status: 'Waiting for class'
    };

    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.save.mockImplementation(async (user) => {
      user.id = 'new-user-id';
      return user as any;
    });
    studentRepository.save.mockImplementation(async (student) => student as any);

    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

    const result = await useCase.execute(dto);

    expect(userRepository.findByEmail).toHaveBeenCalledWith('0987654321');
    expect(bcrypt.hash).toHaveBeenCalledWith('123456', 'salt');
    expect(userRepository.save).toHaveBeenCalled();
    expect(studentRepository.save).toHaveBeenCalled();
    expect(result.firstName).toBe('John');
    expect(result.userId).toBe('new-user-id');
    expect(result.studentId).toBe('STU-1001');
  });

  it('should throw ConflictException if user with student mobile already exists', async () => {
    const dto: CreateStudentDto = {
      firstName: 'Jane',
      lastName: 'Doe',
      mobile: '0987654321',
    };

    userRepository.findByEmail.mockResolvedValue({ id: 'user-id-123' } as any);

    await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
    await expect(useCase.execute(dto)).rejects.toThrow('Số điện thoại đăng nhập học sinh đã tồn tại trên hệ thống');
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ConflictException if student with same name and mobile already exists', async () => {
    const dto: CreateStudentDto = {
      firstName: 'John',
      lastName: 'Doe',
      mobile: '0987654321',
    };

    // Mock existing student in repo
    studentRepository.findAll.mockResolvedValue([
      {
        firstName: 'John',
        lastName: 'Doe',
        mobile: '0987654321',
      }
    ] as any);

    await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
    await expect(useCase.execute(dto)).rejects.toThrow('Học sinh với họ tên và số điện thoại này đã tồn tại trên hệ thống');
  });

  it('should generate sequential studentIds correctly based on existing records', async () => {
    const dto: CreateStudentDto = { firstName: 'Bob', lastName: 'Marley', mobile: '0987654321' };

    // Mock that there are already 5 students
    studentRepository.findAll.mockResolvedValue([{}, {}, {}, {}, {}] as any);
    studentRepository.save.mockImplementation(async (student) => student as any);

    const result = await useCase.execute(dto);

    // If there are 5 students, the count is 5, so next is 1001 + 5 = 1006
    expect(result.studentId).toBe('STU-1006');
  });

  it('should upload avatar to MinIO if base64 is provided', async () => {
    const dto: CreateStudentDto = { 
      firstName: 'Charlie', 
      lastName: 'Puth',
      mobile: '0987654321',
      avatar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE'
    };

    minioService.uploadBase64Image.mockResolvedValue('http://minio/avatars/uploaded.png');
    studentRepository.save.mockImplementation(async (student) => student as any);

    const result = await useCase.execute(dto);

    expect(minioService.uploadBase64Image).toHaveBeenCalledWith(dto.avatar, 'avatars');
    expect(result.avatar).toBe('http://minio/avatars/uploaded.png');
  });

  it('should not upload avatar if it is just a URL (not base64)', async () => {
    const dto: CreateStudentDto = { 
      firstName: 'David', 
      lastName: 'Guetta',
      mobile: '0987654321',
      avatar: 'http://existing-url.com/avatar.png'
    };

    studentRepository.save.mockImplementation(async (student) => student as any);

    const result = await useCase.execute(dto);

    expect(minioService.uploadBase64Image).not.toHaveBeenCalled();
    expect(result.avatar).toBe('http://existing-url.com/avatar.png');
  });
});
