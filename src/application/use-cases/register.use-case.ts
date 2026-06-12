import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { User } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { RegisterDto } from '../dtos/auth.dto';

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: RegisterDto): Promise<User> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('Email đã tồn tại trên hệ thống');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // Create Domain Entity (aggregate)
    const user = new User(
      Math.random().toString(36).substring(2, 9),
      dto.email,
      passwordHash,
      dto.name,
      dto.role,
      true,
    );

    const savedUser = await this.userRepository.save(user);

    // Mutate copy or original to exclude passwordHash but keep methods
    delete (savedUser as any).passwordHash;
    return savedUser;
  }
}
