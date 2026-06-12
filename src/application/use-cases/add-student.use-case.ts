import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Student } from '../../domain/entities/student.entity';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/value-objects/role.enum';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { CreateStudentDto } from '../dtos/student.dto';

@Injectable()
export class AddStudentUseCase {
  constructor(
    private readonly studentRepository: IStudentRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: CreateStudentDto): Promise<Student> {
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
      
      const newUserId = `usr-${Math.random().toString(36).substring(2, 11)}`;
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
    const students = await this.studentRepository.findAll();
    const count = students.length;
    const studentId = `STU-${1001 + count}`;

    // 3. Khởi tạo đối tượng domain Student
    const randomUuid = `std-${Math.random().toString(36).substring(2, 11)}`;
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
    );

    return this.studentRepository.save(student);
  }
}
