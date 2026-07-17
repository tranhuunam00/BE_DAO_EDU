import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Student } from '../../domain/entities/student.entity';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/value-objects/role.enum';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { CreateStudentDto } from '../dtos/student.dto';
import { FileStoragePort } from '../ports/file-storage.port';

@Injectable()
export class AddStudentUseCase {
  constructor(
    private readonly studentRepository: IStudentRepository,
    private readonly userRepository: IUserRepository,
    private readonly fileStorage: FileStoragePort,
  ) {}

  async execute(dto: CreateStudentDto): Promise<Student> {
    // Kiểm tra trùng họ tên và số điện thoại
    const students = await this.studentRepository.findAll();
    const isDuplicate = students.some(s => 
      (s.firstName || '').trim().toLowerCase() === (dto.firstName || '').trim().toLowerCase() &&
      (s.lastName || '').trim().toLowerCase() === (dto.lastName || '').trim().toLowerCase() &&
      (s.mobile || '').trim() === (dto.mobile || '').trim()
    );
    if (isDuplicate) {
      throw new ConflictException('Học sinh với họ tên và số điện thoại này đã tồn tại trên hệ thống');
    }

    // 1. Kiểm tra tài khoản đăng nhập nếu được khai báo
    let createdUserId: string | undefined = undefined;
    if (dto.loginEmail) {
      const existingUser = await this.userRepository.findByEmail(dto.loginEmail);
      if (existingUser) {
        throw new ConflictException('Email đăng nhập học sinh đã tồn tại trên hệ thống');
      }

      // Tạo tài khoản User đăng nhập
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(dto.loginPassword || 'student123', salt);
      
      const newUserId = randomUUID();
      const user = new User(
        newUserId,
        dto.loginEmail.toLowerCase(),
        passwordHash,
        `${dto.lastName} ${dto.firstName}`.trim(),
        Role.STUDENT,
        true
      );
      
      const savedUser = await this.userRepository.save(user);
      createdUserId = savedUser.id;
    }

    // 2. Tạo mã học sinh tuần tự (STU-1001, STU-1002, ...)
    const count = students.length;
    const studentId = `STU-${1001 + count}`;

    // 3. Upload avatar to MinIO if provided as base64
    let avatarUrl = dto.avatar;
    if (avatarUrl && avatarUrl.startsWith('data:image')) {
      avatarUrl = await this.fileStorage.uploadBase64Image(avatarUrl, 'avatars');
    }

    // 4. Khởi tạo đối tượng domain Student
    const randomUuid = randomUUID();
    const student = new Student(
      randomUuid,
      studentId,
      dto.firstName,
      dto.lastName,
      dto.nickName,
      dto.gender,
      dto.mobile,
      dto.email,
      dto.birthdate,
      dto.parentGuardian1,
      dto.parentGuardian2,
      dto.parent1CitizenId,
      dto.parent2CitizenId,
      dto.studentCitizenId,
      dto.relationship1,
      dto.relationship2,
      dto.otherPhone1,
      dto.otherPhone2,
      dto.description,
      dto.country || 'Việt Nam',
      dto.province,
      dto.districtWard,
      dto.primaryAddress,
      dto.oldAddress,
      dto.status || 'Waiting for class',
      createdUserId,
      avatarUrl,
    );

    return this.studentRepository.save(student);
  }
}
