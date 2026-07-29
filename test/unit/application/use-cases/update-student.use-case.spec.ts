import { NotFoundException, ConflictException } from '@nestjs/common';
import { UpdateStudentUseCase } from '../../../../src/application/use-cases/update-student.use-case';
import { IStudentRepository } from '../../../../src/domain/repositories/student-repository.interface';
import { IUserRepository } from '../../../../src/domain/repositories/user-repository.interface';
import { MinioService } from '../../../../src/infrastructure/storage/minio.service';
import { UpdateStudentDto } from '../../../../src/application/dtos/student.dto';
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
      findAll: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
    } as any;

    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
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

  it('should link student to existing user when updating loginEmail to an email that already exists', async () => {
    const existingStudent = { id: '1', userId: 'user-1', getFullName: () => 'John Doe' };
    studentRepository.findById.mockResolvedValue(existingStudent as any);
    studentRepository.findAll.mockResolvedValue([existingStudent] as any);
    
    const existingUser = { id: 'user-2', email: 'exists@example.com' };
    userRepository.findById.mockResolvedValue({ id: 'user-1', email: 'old@example.com' } as any);
    userRepository.findByEmail.mockResolvedValue(existingUser as any);
    userRepository.save.mockImplementation(async (user) => user as any);
    studentRepository.save.mockImplementation(async (student) => student as any);

    const dto: UpdateStudentDto = { loginEmail: 'exists@example.com' } as any;

    const result = await useCase.execute('1', dto);

    expect(result.userId).toBe('user-2');
    expect(userRepository.delete).toHaveBeenCalledWith('user-1'); // Old single user should be deleted
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

  it('should split account and create new user when updating loginEmail of a student who shares account with siblings', async () => {
    const student1 = { id: '1', userId: 'user-shared-id', getFullName: () => 'Student A' };
    const student2 = { id: '2', userId: 'user-shared-id', getFullName: () => 'Student B' };
    studentRepository.findById.mockResolvedValue(student1 as any);
    studentRepository.findAll.mockResolvedValue([student1, student2] as any);

    userRepository.findById.mockResolvedValue({ id: 'user-shared-id', email: '0905102040' } as any);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.save.mockImplementation(async (user) => {
      user.id = user.id || 'new-split-user-id';
      return user as any;
    });
    studentRepository.save.mockImplementation(async (student) => student as any);

    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

    const dto: UpdateStudentDto = { loginEmail: '0905102099', loginPassword: '123' } as any;

    const result = await useCase.execute('1', dto);

    // It should create a new user account for the new email to split them
    expect(userRepository.save).toHaveBeenCalled();
    expect(result.userId).not.toBe('user-shared-id');
    expect(result.userId).toBeDefined();
  });

  it('should update the existing user when updating loginEmail of a student who does not share account with siblings', async () => {
    const student1 = { id: '1', userId: 'user-single-id', getFullName: () => 'Student A' };
    studentRepository.findById.mockResolvedValue(student1 as any);
    studentRepository.findAll.mockResolvedValue([student1] as any);

    const sharedUser = { id: 'user-single-id', email: 'old@example.com' };
    userRepository.findById.mockResolvedValue(sharedUser as any);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.save.mockImplementation(async (user) => user as any);
    studentRepository.save.mockImplementation(async (student) => student as any);

    const dto: UpdateStudentDto = { loginEmail: 'new@example.com' } as any;

    const result = await useCase.execute('1', dto);

    // It should update the existing user and NOT create a new user
    expect(sharedUser.email).toBe('new@example.com');
    expect(userRepository.save).toHaveBeenCalled();
    expect(result.userId).toBe('user-single-id');
  });

  it('should link student to existing user and not delete the old user when updating loginEmail of a student who shares account with siblings to another already existing email', async () => {
    const student1 = { id: '1', userId: 'user-shared-id', getFullName: () => 'Student A' };
    const student2 = { id: '2', userId: 'user-shared-id', getFullName: () => 'Student B' };
    studentRepository.findById.mockResolvedValue(student1 as any);
    studentRepository.findAll.mockResolvedValue([student1, student2] as any);

    const existingUser = { id: 'user-existing-id', email: 'exists@example.com' };
    userRepository.findById.mockResolvedValue({ id: 'user-shared-id', email: '0905102040' } as any);
    userRepository.findByEmail.mockResolvedValue(existingUser as any);
    studentRepository.save.mockImplementation(async (student) => student as any);

    const dto: UpdateStudentDto = { loginEmail: 'exists@example.com' } as any;

    const result = await useCase.execute('1', dto);

    // It should link Student A to the existing user and NOT delete the old shared user
    expect(result.userId).toBe('user-existing-id');
    expect(userRepository.delete).not.toHaveBeenCalled();
  });
});
