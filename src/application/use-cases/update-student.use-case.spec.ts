import { NotFoundException, ConflictException } from '@nestjs/common';
import { UpdateStudentUseCase } from './update-student.use-case';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { UpdateStudentDto } from '../dtos/student.dto';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('UpdateStudentUseCase', () => {
  let useCase: UpdateStudentUseCase;
  let studentRepository: jest.Mocked<IStudentRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let minioService: jest.Mocked<MinioService>;

  beforeEach(() => {
    studentRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    } as any;

    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
    } as any;

    minioService = {
      uploadBase64Image: jest.fn(),
    } as any;

    useCase = new UpdateStudentUseCase(studentRepository, userRepository, minioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw NotFoundException if student is not found', async () => {
    studentRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute('invalid-id', {})).rejects.toThrow(NotFoundException);
  });

  it('should update basic student information', async () => {
    const existingStudent = { id: '1', firstName: 'Old', lastName: 'Name' };
    studentRepository.findById.mockResolvedValue(existingStudent as any);
    studentRepository.save.mockImplementation(async (student) => student as any);

    const dto: UpdateStudentDto = { firstName: 'New', status: 'Inactive' } as any;

    const result = await useCase.execute('1', dto);

    expect(result.firstName).toBe('New');
    expect(result.status).toBe('Inactive');
    expect(studentRepository.save).toHaveBeenCalled();
  });

  it('should upload avatar to MinIO if base64 is provided', async () => {
    const existingStudent = { id: '1', studentId: 'STU-1001' };
    studentRepository.findById.mockResolvedValue(existingStudent as any);
    minioService.uploadBase64Image.mockResolvedValue('http://minio/avatar.png');
    studentRepository.save.mockImplementation(async (student) => student as any);

    const dto: UpdateStudentDto = { avatar: 'data:image/png;base64,123' } as any;

    const result = await useCase.execute('1', dto);

    expect(minioService.uploadBase64Image).toHaveBeenCalledWith(dto.avatar, 'avatars');
    expect(result.avatar).toBe('http://minio/avatar.png');
  });

  it('should throw ConflictException if trying to update user with existing email of another user', async () => {
    const existingStudent = { id: '1', userId: 'user-1' };
    studentRepository.findById.mockResolvedValue(existingStudent as any);
    
    userRepository.findById.mockResolvedValue({ id: 'user-1', email: 'old@example.com' } as any);
    userRepository.findByEmail.mockResolvedValue({ id: 'user-2' } as any); // existing email belongs to another user

    const dto: UpdateStudentDto = { loginEmail: 'exists@example.com' } as any;

    await expect(useCase.execute('1', dto)).rejects.toThrow(ConflictException);
  });

  it('should update user password if loginPassword is provided', async () => {
    const existingStudent = { id: '1', userId: 'user-1', getFullName: () => 'John Doe' };
    studentRepository.findById.mockResolvedValue(existingStudent as any);
    
    userRepository.findById.mockResolvedValue({ id: 'user-1', email: 'old@example.com' } as any);
    userRepository.save.mockImplementation(async (user) => user as any);
    studentRepository.save.mockImplementation(async (student) => student as any);

    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('newHash');

    const dto: UpdateStudentDto = { loginPassword: 'newPassword' } as any;

    await useCase.execute('1', dto);

    expect(bcrypt.hash).toHaveBeenCalledWith('newPassword', 'salt');
    expect(userRepository.save).toHaveBeenCalled();
  });

  it('should create new user if student has no user and loginEmail is provided', async () => {
    const existingStudent = { id: '1', userId: null, getFullName: () => 'John Doe' };
    studentRepository.findById.mockResolvedValue(existingStudent as any);
    
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.save.mockImplementation(async (user) => {
      user.id = 'new-user-id';
      return user as any;
    });
    studentRepository.save.mockImplementation(async (student) => student as any);

    const dto: UpdateStudentDto = { loginEmail: 'new@example.com' } as any;

    const result = await useCase.execute('1', dto);

    expect(userRepository.save).toHaveBeenCalled();
    expect(result.userId).toBe('new-user-id');
  });
});
