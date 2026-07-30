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
    // Tự động tạo tài khoản đăng nhập cho giáo viên (ưu tiên email, fallback sang mobile)
    let createdUserId: string | undefined = undefined;
    const emailRaw = (dto.email || '').trim().toLowerCase();
    const mobileRaw = (dto.mobile || '').trim().toLowerCase();
    const username = emailRaw || mobileRaw;

    if (!username) {
      throw new ConflictException('Giáo viên phải có email hoặc số điện thoại để tự động tạo tài khoản');
    }

    const existingUser = await this.userRepository.findByEmail(username);
    if (existingUser) {
      throw new ConflictException('Tài khoản đăng nhập (Email/SĐT) giáo viên đã tồn tại trên hệ thống');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('educare123', salt);
    
    const newUserId = randomUUID();
    const user = new User(
      newUserId,
      username,
      passwordHash,
      `${dto.lastName} ${dto.firstName}`.trim(),
      Role.TEACHER,
      true
    );
    
    const savedUser = await this.userRepository.save(user);
    createdUserId = savedUser.id;
    console.log(
      `[Auto-Account] Đã tự động sinh tài khoản giáo viên/TA: username=${username}, password=educare123`,
    );

    const teachers = await this.teacherRepository.findAll();
    let maxIdNum = 1000;
    for (const t of teachers) {
      if (t.teacherId && t.teacherId.startsWith('TCH-')) {
        const num = parseInt(t.teacherId.replace('TCH-', ''), 10);
        if (!isNaN(num) && num > maxIdNum) {
          maxIdNum = num;
        }
      }
    }
    const teacherId = maxIdNum > 1000
      ? `TCH-${maxIdNum + 1}`
      : `TCH-${1001 + teachers.length}`;

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
