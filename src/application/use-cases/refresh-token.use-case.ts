import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { RefreshTokenDto } from '../dtos/auth.dto';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(dto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET', 'SUPER_SECRET_KEY_FOR_DEV_ONLY_12345'),
      });
    } catch (err) {
      throw new UnauthorizedException('Refresh Token không hợp lệ hoặc đã hết hạn');
    }

    const userId = payload.sub;
    if (!userId) {
      throw new UnauthorizedException('Token payload không hợp lệ');
    }

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Người dùng không tồn tại hoặc đã bị vô hiệu hóa');
    }

    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn hoặc không hợp lệ');
    }

    const isMatch = await bcrypt.compare(dto.refreshToken, user.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Refresh Token không khớp');
    }

    // Generate new tokens (Token Rotation)
    const newPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(newPayload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign({ sub: user.id }, { expiresIn: '7d' });

    // Save new hashed refresh token
    const salt = await bcrypt.genSalt(10);
    user.refreshTokenHash = await bcrypt.hash(refreshToken, salt);
    await this.userRepository.save(user);

    // Remove passwordHash and refreshTokenHash before returning
    delete (user as any).passwordHash;
    delete (user as any).refreshTokenHash;

    return {
      accessToken,
      refreshToken,
      user,
    };
  }
}
