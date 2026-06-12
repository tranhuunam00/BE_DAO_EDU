import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/value-objects/role.enum';
import { Teacher } from '../../domain/entities/teacher.entity';
import { ITeacherRepository } from '../../domain/repositories/teacher-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { UpdateTeacherDto } from '../dtos/teacher.dto';
import { MinioService } from '../../infrastructure/storage/minio.service';

@Injectable()
export class UpdateTeacherUseCase {
  constructor(
    private readonly teacherRepository: ITeacherRepository,
    private readonly userRepository: IUserRepository,
    private readonly minioService: MinioService,
  ) {}

  async execute(id: string, dto: UpdateTeacherDto): Promise<Teacher> {
    const teacher = await this.teacherRepository.findById(id);
    if (!teacher) {
      throw new NotFoundException('Không tìm thấy giáo viên');
    }

    if (dto.firstName !== undefined) teacher.firstName = dto.firstName;
    if (dto.lastName !== undefined) teacher.lastName = dto.lastName;
    if (dto.gender !== undefined) teacher.gender = dto.gender;
    if (dto.birthdate !== undefined) teacher.birthdate = dto.birthdate;
    if (dto.mobile !== undefined) teacher.mobile = dto.mobile;
    if (dto.email !== undefined) teacher.email = dto.email;
    if (dto.citizenId !== undefined) teacher.citizenId = dto.citizenId;
    if (dto.type !== undefined) teacher.type = dto.type;
    if (dto.country !== undefined) teacher.country = dto.country;
    if (dto.province !== undefined) teacher.province = dto.province;
    if (dto.districtWard !== undefined) teacher.districtWard = dto.districtWard;
    if (dto.primaryAddress !== undefined) teacher.primaryAddress = dto.primaryAddress;
    if (dto.status !== undefined) teacher.status = dto.status;

    if (dto.avatar && dto.avatar.startsWith('data:image')) {
      teacher.avatar = await this.minioService.uploadBase64Image(dto.avatar, teacher.teacherId);
    }

    if (!teacher.userId && dto.loginEmail && dto.loginPassword) {
      const existingUser = await this.userRepository.findByEmail(dto.loginEmail);
      if (existingUser) {
        throw new ConflictException('Email đăng nhập giáo viên đã tồn tại trên hệ thống');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(dto.loginPassword, salt);
      
      const newUserId = randomUUID();
      const user = new User(
        newUserId,
        dto.loginEmail.toLowerCase(),
        passwordHash,
        `${teacher.lastName} ${teacher.firstName}`.trim(),
        Role.TEACHER,
        true
      );
      
      const savedUser = await this.userRepository.save(user);
      teacher.userId = savedUser.id;
      teacher.loginEmail = savedUser.email;
    }

    return this.teacherRepository.save(teacher);
  }
}
