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

    // 1. Luôn tự động tạo tài khoản đăng nhập cho học sinh bằng số điện thoại
    let createdUserId: string | undefined = undefined;
    const username = (dto.mobile || '').trim().toLowerCase();
    
    const existingUser = await this.userRepository.findByEmail(username);
    if (existingUser) {
      // Dùng chung tài khoản phụ huynh đã tồn tại cho các học sinh chị em
      createdUserId = existingUser.id;
      console.log(
        `[Auto-Account] Số điện thoại ${username} đã có tài khoản. Liên kết học sinh mới với tài khoản có sẵn: userId=${createdUserId}`,
      );
    } else {
      // Tạo tài khoản User đăng nhập mới
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('123456', salt);
      
      const newUserId = randomUUID();
      const user = new User(
        newUserId,
        username,
        passwordHash,
        `${dto.lastName} ${dto.firstName}`.trim(),
        Role.STUDENT,
        true
      );
      
      const savedUser = await this.userRepository.save(user);
      createdUserId = savedUser.id;
      console.log(
        `[Auto-Account] Đã tự động sinh tài khoản học sinh: username=${username}, password=123456`,
      );
    }

    // 2. Tạo mã học sinh tuần tự (STU-1001, STU-1002, ...) bằng cách lấy số ID lớn nhất để tránh trùng lặp
    let maxIdNum = 1000;
    for (const s of students) {
      if (s.studentId && s.studentId.startsWith('STU-')) {
        const num = parseInt(s.studentId.replace('STU-', ''), 10);
        if (!isNaN(num) && num > maxIdNum) {
          maxIdNum = num;
        }
      }
    }
    const studentId = maxIdNum > 1000
      ? `STU-${maxIdNum + 1}`
      : `STU-${1001 + students.length}`;

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
