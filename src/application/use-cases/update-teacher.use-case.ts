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

    const previousFirstName = teacher.firstName;
    const previousLastName = teacher.lastName;

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

    const normalizedLoginEmail = dto.loginEmail?.trim().toLowerCase();

    if (!teacher.userId && normalizedLoginEmail && dto.loginPassword) {
      const existingUser = await this.userRepository.findByEmail(normalizedLoginEmail);
      if (existingUser) {
        throw new ConflictException('Email đăng nhập giáo viên đã tồn tại trên hệ thống');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(dto.loginPassword, salt);
      
      const newUserId = randomUUID();
      const user = new User(
        newUserId,
        normalizedLoginEmail,
        passwordHash,
        `${teacher.lastName} ${teacher.firstName}`.trim(),
        Role.TEACHER,
        true
      );
      
      const savedUser = await this.userRepository.save(user);
      teacher.userId = savedUser.id;
      teacher.loginEmail = savedUser.email;
    } else if (teacher.userId) {
      const user = await this.userRepository.findById(teacher.userId);
      if (!user) {
        throw new NotFoundException('Không tìm thấy tài khoản đăng nhập của giáo viên');
      }

      let shouldSaveUser = false;

      if (normalizedLoginEmail && normalizedLoginEmail !== user.email.toLowerCase()) {
        const existingUser = await this.userRepository.findByEmail(normalizedLoginEmail);
        if (existingUser && existingUser.id !== user.id) {
          throw new ConflictException('Email đăng nhập giáo viên đã tồn tại trên hệ thống');
        }
        user.email = normalizedLoginEmail;
        shouldSaveUser = true;
      }

      if (dto.loginPassword) {
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(dto.loginPassword, salt);
        user.refreshTokenHash = null;
        shouldSaveUser = true;
      }

      if (teacher.firstName !== previousFirstName || teacher.lastName !== previousLastName) {
        user.name = `${teacher.lastName} ${teacher.firstName}`.trim();
        shouldSaveUser = true;
      }

      if (shouldSaveUser) {
        const savedUser = await this.userRepository.save(user);
        teacher.loginEmail = savedUser.email;
      } else {
        teacher.loginEmail = user.email;
      }
    }

    const savedTeacher = await this.teacherRepository.save(teacher);
    savedTeacher.loginEmail = teacher.loginEmail;
    return savedTeacher;
  }
}
