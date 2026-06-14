import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Teacher } from '../../domain/entities/teacher.entity';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/value-objects/role.enum';
import { ITeacherRepository } from '../../domain/repositories/teacher-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { CreateTeacherDto } from '../dtos/teacher.dto';
import { FileStoragePort } from '../ports/file-storage.port';

@Injectable()
export class AddTeacherUseCase {
  constructor(
    private readonly teacherRepository: ITeacherRepository,
    private readonly userRepository: IUserRepository,
    private readonly fileStorage: FileStoragePort,
  ) {}

  async execute(dto: CreateTeacherDto): Promise<Teacher> {
    let createdUserId: string | undefined = undefined;
    if (dto.loginEmail) {
      const existingUser = await this.userRepository.findByEmail(dto.loginEmail);
      if (existingUser) {
        throw new ConflictException('Email đăng nhập giáo viên đã tồn tại trên hệ thống');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(dto.loginPassword || 'teacher123', salt);
      
      const newUserId = randomUUID();
      const user = new User(
        newUserId,
        dto.loginEmail.toLowerCase(),
        passwordHash,
        `${dto.lastName} ${dto.firstName}`.trim(),
        Role.TEACHER,
        true
      );
      
      const savedUser = await this.userRepository.save(user);
      createdUserId = savedUser.id;
    }

    const teachers = await this.teacherRepository.findAll();
    const count = teachers.length;
    const teacherId = `TCH-${1001 + count}`;

    let avatarUrl: string | undefined = undefined;
    if (dto.avatar && dto.avatar.startsWith('data:image')) {
      avatarUrl = await this.fileStorage.uploadBase64Image(dto.avatar, teacherId);
    }

    const teacher = new Teacher(
      randomUUID(),
      teacherId,
      dto.firstName,
      dto.lastName,
      dto.gender,
      dto.birthdate,
      dto.mobile,
      dto.email,
      dto.citizenId,
      dto.type,
      dto.country,
      dto.province,
      dto.districtWard,
      dto.primaryAddress,
      dto.status,
      createdUserId,
      avatarUrl,
      dto.loginEmail
    );

    return this.teacherRepository.save(teacher);
  }
}
