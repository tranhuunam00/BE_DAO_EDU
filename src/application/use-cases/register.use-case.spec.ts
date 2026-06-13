import { BadRequestException } from '@nestjs/common';
import { RegisterUseCase } from './register.use-case';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/value-objects/role.enum';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
    } as any;

    useCase = new RegisterUseCase(userRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException if email already exists', async () => {
    userRepository.findByEmail.mockResolvedValue({ id: '1' } as any);
    await expect(
      useCase.execute({ email: 'test@test.com', password: '123', name: 'Test', role: Role.ADMIN })
    ).rejects.toThrow(BadRequestException);
    await expect(
      useCase.execute({ email: 'test@test.com', password: '123', name: 'Test', role: Role.ADMIN })
    ).rejects.toThrow('Email đã tồn tại trên hệ thống');
  });

  it('should successfully register a new user', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.save.mockImplementation(async (u) => u as any);

    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

    const result = await useCase.execute({
      email: 'new@test.com',
      password: 'secretPassword',
      name: 'New Admin',
      role: Role.ADMIN,
    });

    expect(userRepository.save).toHaveBeenCalled();
    expect(result.email).toBe('new@test.com');
    expect(result.name).toBe('New Admin');
    expect(result.role).toBe(Role.ADMIN);
    expect((result as any).passwordHash).toBeUndefined(); // Password hash should be deleted from response
  });
});
