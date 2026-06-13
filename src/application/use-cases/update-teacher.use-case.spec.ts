import { NotFoundException, ConflictException } from '@nestjs/common';
import { UpdateTeacherUseCase } from './update-teacher.use-case';
import { ITeacherRepository } from '../../domain/repositories/teacher-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { UpdateTeacherDto } from '../dtos/teacher.dto';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('UpdateTeacherUseCase', () => {
  let useCase: UpdateTeacherUseCase;
  let teacherRepository: jest.Mocked<ITeacherRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let minioService: jest.Mocked<MinioService>;

  beforeEach(() => {
    teacherRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
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

    useCase = new UpdateTeacherUseCase(teacherRepository, userRepository, minioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw NotFoundException if teacher is not found', async () => {
    teacherRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute('invalid-id', {})).rejects.toThrow(NotFoundException);
  });

  it('should update basic teacher information', async () => {
    const existingTeacher = { id: '1', teacherId: 'TCH-1001', firstName: 'Old', lastName: 'Name' };
    teacherRepository.findById.mockResolvedValue(existingTeacher as any);
    teacherRepository.save.mockImplementation(async (teacher) => teacher as any);

    const dto: UpdateTeacherDto = { firstName: 'New', status: 'Inactive' } as any;

    const result = await useCase.execute('1', dto);

    expect(result.firstName).toBe('New');
    expect(result.status).toBe('Inactive');
    expect(teacherRepository.save).toHaveBeenCalled();
  });

  it('should upload avatar to MinIO if base64 is provided', async () => {
    const existingTeacher = { id: '1', teacherId: 'TCH-1001' };
    teacherRepository.findById.mockResolvedValue(existingTeacher as any);
    minioService.uploadBase64Image.mockResolvedValue('http://minio/avatar.png');
    teacherRepository.save.mockImplementation(async (teacher) => teacher as any);

    const dto: UpdateTeacherDto = { avatar: 'data:image/png;base64,123' } as any;

    const result = await useCase.execute('1', dto);

    expect(minioService.uploadBase64Image).toHaveBeenCalledWith(dto.avatar, 'TCH-1001');
    expect(result.avatar).toBe('http://minio/avatar.png');
  });

  it('should throw ConflictException if trying to create user with existing email', async () => {
    const existingTeacher = { id: '1', teacherId: 'TCH-1001', userId: null };
    teacherRepository.findById.mockResolvedValue(existingTeacher as any);
    userRepository.findByEmail.mockResolvedValue({ id: '2' } as any);

    const dto: UpdateTeacherDto = { loginEmail: 'exists@example.com', loginPassword: '123' } as any;

    await expect(useCase.execute('1', dto)).rejects.toThrow(ConflictException);
  });

  it('should create a new user account if loginEmail and password are provided', async () => {
    const existingTeacher = { id: '1', teacherId: 'TCH-1001', userId: null, firstName: 'John', lastName: 'Doe' };
    teacherRepository.findById.mockResolvedValue(existingTeacher as any);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.save.mockImplementation(async (user) => {
      user.id = 'new-user-id';
      return user as any;
    });
    teacherRepository.save.mockImplementation(async (teacher) => teacher as any);

    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

    const dto: UpdateTeacherDto = { loginEmail: 'new@example.com', loginPassword: '123' } as any;

    const result = await useCase.execute('1', dto);

    expect(userRepository.save).toHaveBeenCalled();
    expect(result.userId).toBe('new-user-id');
    expect(result.loginEmail).toBe('new@example.com');
  });
});
