import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/value-objects/role.enum';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

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
      verifyAsync: jest.fn(),
    } as any;

    configService = {
      get: jest.fn().mockReturnValue('secret'),
    } as any;

    useCase = new RefreshTokenUseCase(userRepository, jwtService, configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw UnauthorizedException if token is invalid or expired', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('Expired'));
    await expect(useCase.execute({ refreshToken: 'invalid' })).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute({ refreshToken: 'invalid' })).rejects.toThrow('Refresh Token không hợp lệ hoặc đã hết hạn');
  });

  it('should throw UnauthorizedException if payload has no sub', async () => {
    jwtService.verifyAsync.mockResolvedValue({});
    await expect(useCase.execute({ refreshToken: 'valid-no-sub' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if user not found or inactive', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: '1' });
    userRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute({ refreshToken: 'valid-token' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if user has no refreshTokenHash', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: '1' });
    const user = new User('1', 'test@test.com', 'hash', 'Test', Role.ADMIN, true);
    userRepository.findById.mockResolvedValue(user);
    await expect(useCase.execute({ refreshToken: 'valid-token' })).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute({ refreshToken: 'valid-token' })).rejects.toThrow('Phiên đăng nhập đã hết hạn hoặc không hợp lệ');
  });

  it('should throw UnauthorizedException if token does not match hash', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: '1' });
    const user = new User('1', 'test@test.com', 'hash', 'Test', Role.ADMIN, true);
    user.refreshTokenHash = 'hash-of-old-token';
    userRepository.findById.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(useCase.execute({ refreshToken: 'valid-but-wrong-token' })).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute({ refreshToken: 'valid-but-wrong-token' })).rejects.toThrow('Refresh Token không khớp');
  });

  it('should successfully refresh tokens', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: '1' });
    const user = new User('1', 'test@test.com', 'hash', 'Test', Role.ADMIN, true);
    user.refreshTokenHash = 'correct-hash';
    userRepository.findById.mockResolvedValue(user);
    userRepository.save.mockResolvedValue(user);

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-refresh-hash');

    jwtService.sign.mockReturnValueOnce('new-access-token');
    jwtService.sign.mockReturnValueOnce('new-refresh-token');

    const result = await useCase.execute({ refreshToken: 'valid-token' });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(result.user.id).toBe('1');
    expect((result.user as any).refreshTokenHash).toBeUndefined();
    expect(userRepository.save).toHaveBeenCalled();
  });
});
