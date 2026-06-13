import { ConflictException } from '@nestjs/common';
import { AddStudentUseCase } from './add-student.use-case';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { CreateStudentDto } from '../dtos/student.dto';
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
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
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

  it('should successfully add a student without login account', async () => {
    const dto: CreateStudentDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      mobile: '0987654321',
      gender: 'Nam',
      birthdate: new Date('2010-01-01'),
      status: 'Waiting for class'
    };

    studentRepository.save.mockImplementation(async (student) => student as any);

    const result = await useCase.execute(dto);

    expect(userRepository.findByEmail).not.toHaveBeenCalled();
    expect(studentRepository.save).toHaveBeenCalled();
    expect(result.firstName).toBe('John');
    expect(result.userId).toBeUndefined();
    expect(result.studentId).toBe('STU-1001');
  });

  it('should throw ConflictException if loginEmail already exists', async () => {
    const dto: CreateStudentDto = {
      firstName: 'Jane',
      lastName: 'Doe',
      loginEmail: 'jane@example.com',
      loginPassword: 'password123',
    };

    userRepository.findByEmail.mockResolvedValue({ id: 'user-id-123' } as any);

    await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
    await expect(useCase.execute(dto)).rejects.toThrow('Email đăng nhập học sinh đã tồn tại trên hệ thống');
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('should successfully add a student and create a user account', async () => {
    const dto: CreateStudentDto = {
      firstName: 'Alice',
      lastName: 'Smith',
      loginEmail: 'alice@example.com',
      loginPassword: 'password123',
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

    expect(userRepository.findByEmail).toHaveBeenCalledWith('alice@example.com');
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'salt');
    expect(userRepository.save).toHaveBeenCalled();
    expect(studentRepository.save).toHaveBeenCalled();
    expect(result.userId).toBe('new-user-id');
  });

  it('should generate sequential studentIds correctly based on existing records', async () => {
    const dto: CreateStudentDto = { firstName: 'Bob', lastName: 'Marley' };

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
      avatar: 'http://existing-url.com/avatar.png'
    };

    studentRepository.save.mockImplementation(async (student) => student as any);

    const result = await useCase.execute(dto);

    expect(minioService.uploadBase64Image).not.toHaveBeenCalled();
    expect(result.avatar).toBe('http://existing-url.com/avatar.png');
  });
});
