import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginUseCase } from './login.use-case';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/value-objects/role.enum';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    userRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
    } as any;

    jwtService = {
      sign: jest.fn(),
    } as any;

    useCase = new LoginUseCase(userRepository, jwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw UnauthorizedException if user not found', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    await expect(useCase.execute({ email: 'test@test.com', password: '123' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if password does not match', async () => {
    userRepository.findByEmail.mockResolvedValue(new User('1', 'test@test.com', 'hash', 'Test', Role.ADMIN, true));
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(useCase.execute({ email: 'test@test.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
  });

  it('should successfully login and return tokens', async () => {
    const user = new User('1', 'test@test.com', 'hash', 'Test', Role.ADMIN, true);
    userRepository.findByEmail.mockResolvedValue(user);
    userRepository.save.mockResolvedValue(user);

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('newHash');

    jwtService.sign.mockReturnValueOnce('access-token');
    jwtService.sign.mockReturnValueOnce('refresh-token');

    const result = await useCase.execute({ email: 'test@test.com', password: 'correct' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.id).toBe('1');
    expect((result.user as any).passwordHash).toBeUndefined(); // Should be deleted
  });
});
