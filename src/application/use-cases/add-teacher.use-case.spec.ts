import { ConflictException } from '@nestjs/common';
import { AddTeacherUseCase } from './add-teacher.use-case';
import { ITeacherRepository } from '../../domain/repositories/teacher-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { CreateTeacherDto } from '../dtos/teacher.dto';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AddTeacherUseCase', () => {
  let useCase: AddTeacherUseCase;
  let teacherRepository: jest.Mocked<ITeacherRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let minioService: jest.Mocked<MinioService>;

  beforeEach(() => {
    teacherRepository = {
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

    useCase = new AddTeacherUseCase(teacherRepository, userRepository, minioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully add a teacher without login account', async () => {
    const dto: CreateTeacherDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      mobile: '0987654321',
      gender: 'Nam',
      birthdate: new Date('1990-01-01'),
      status: 'Active',
      type: 'Full-time'
    };

    teacherRepository.save.mockImplementation(async (teacher) => teacher as any);

    const result = await useCase.execute(dto);

    expect(userRepository.findByEmail).not.toHaveBeenCalled();
    expect(teacherRepository.save).toHaveBeenCalled();
    expect(result.firstName).toBe('John');
    expect(result.userId).toBeUndefined();
    expect(result.teacherId).toBe('TCH-1001');
  });

  it('should throw ConflictException if loginEmail already exists', async () => {
    const dto: CreateTeacherDto = {
      firstName: 'Jane',
      lastName: 'Doe',
      loginEmail: 'jane@example.com',
      loginPassword: 'password123',
    } as any;

    userRepository.findByEmail.mockResolvedValue({ id: 'user-id-123' } as any);

    await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
    await expect(useCase.execute(dto)).rejects.toThrow('Email đăng nhập giáo viên đã tồn tại trên hệ thống');
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('should successfully add a teacher and create a user account', async () => {
    const dto: CreateTeacherDto = {
      firstName: 'Alice',
      lastName: 'Smith',
      loginEmail: 'alice@example.com',
      loginPassword: 'password123',
    } as any;

    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.save.mockImplementation(async (user) => {
      user.id = 'new-user-id';
      return user as any;
    });
    teacherRepository.save.mockImplementation(async (teacher) => teacher as any);

    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

    const result = await useCase.execute(dto);

    expect(userRepository.findByEmail).toHaveBeenCalledWith('alice@example.com');
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'salt');
    expect(userRepository.save).toHaveBeenCalled();
    expect(teacherRepository.save).toHaveBeenCalled();
    expect(result.userId).toBe('new-user-id');
  });

  it('should generate sequential teacherIds correctly based on existing records', async () => {
    const dto: CreateTeacherDto = { firstName: 'Bob', lastName: 'Marley' } as any;

    // Mock that there are already 2 teachers
    teacherRepository.findAll.mockResolvedValue([{}, {}] as any);
    teacherRepository.save.mockImplementation(async (teacher) => teacher as any);

    const result = await useCase.execute(dto);

    // If there are 2 teachers, the count is 2, so next is 1001 + 2 = 1003
    expect(result.teacherId).toBe('TCH-1003');
  });

  it('should upload avatar to MinIO if base64 is provided', async () => {
    const dto: CreateTeacherDto = { 
      firstName: 'Charlie', 
      lastName: 'Puth',
      avatar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE'
    } as any;

    minioService.uploadBase64Image.mockResolvedValue('http://minio/TCH-1001/uploaded.png');
    teacherRepository.save.mockImplementation(async (teacher) => teacher as any);

    const result = await useCase.execute(dto);

    expect(minioService.uploadBase64Image).toHaveBeenCalledWith(dto.avatar, 'TCH-1001');
    expect(result.avatar).toBe('http://minio/TCH-1001/uploaded.png');
  });
});
