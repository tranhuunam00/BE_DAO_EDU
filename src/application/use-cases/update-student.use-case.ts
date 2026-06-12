import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { UpdateStudentDto } from '../dtos/student.dto';
import { Student } from '../../domain/entities/student.entity';
import { MinioService } from '../../infrastructure/storage/minio.service';

@Injectable()
export class UpdateStudentUseCase {
  constructor(
    private readonly studentRepository: IStudentRepository,
    private readonly userRepository: IUserRepository,
    private readonly minioService: MinioService,
  ) {}

  async execute(id: string, dto: UpdateStudentDto): Promise<Student> {
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`Không tìm thấy học sinh với ID: ${id}`);
    }

    // Cập nhật các trường thông tin học sinh
    if (dto.firstName !== undefined) student.firstName = dto.firstName;
    if (dto.lastName !== undefined) student.lastName = dto.lastName;
    if (dto.nickName !== undefined) student.nickName = dto.nickName;
    if (dto.gender !== undefined) student.gender = dto.gender;
    if (dto.mobile !== undefined) student.mobile = dto.mobile;
    if (dto.email !== undefined) student.email = dto.email;
    if (dto.birthdate !== undefined) student.birthdate = dto.birthdate;
    if (dto.parentGuardian1 !== undefined) student.parentGuardian1 = dto.parentGuardian1;
    if (dto.parentGuardian2 !== undefined) student.parentGuardian2 = dto.parentGuardian2;
    if (dto.parent1CitizenId !== undefined) student.parent1CitizenId = dto.parent1CitizenId;
    if (dto.parent2CitizenId !== undefined) student.parent2CitizenId = dto.parent2CitizenId;
    if (dto.studentCitizenId !== undefined) student.studentCitizenId = dto.studentCitizenId;
    if (dto.relationship1 !== undefined) student.relationship1 = dto.relationship1;
    if (dto.relationship2 !== undefined) student.relationship2 = dto.relationship2;
    if (dto.otherPhone1 !== undefined) student.otherPhone1 = dto.otherPhone1;
    if (dto.otherPhone2 !== undefined) student.otherPhone2 = dto.otherPhone2;
    if (dto.description !== undefined) student.description = dto.description;
    if (dto.country !== undefined) student.country = dto.country;
    if (dto.province !== undefined) student.province = dto.province;
    if (dto.districtWard !== undefined) student.districtWard = dto.districtWard;
    if (dto.primaryAddress !== undefined) student.primaryAddress = dto.primaryAddress;
    if (dto.oldAddress !== undefined) student.oldAddress = dto.oldAddress;
    if (dto.status !== undefined) student.status = dto.status;
    if (dto.avatar !== undefined) {
      if (dto.avatar && dto.avatar.startsWith('data:image')) {
        student.avatar = await this.minioService.uploadBase64Image(dto.avatar, 'avatars');
      } else {
        student.avatar = dto.avatar;
      }
    }

    // Cập nhật thông tin tài khoản đăng nhập nếu học sinh có tài khoản
    if (student.userId && (dto.loginPassword || dto.loginEmail)) {
      const user = await this.userRepository.findById(student.userId);
      if (user) {
        if (dto.loginEmail && dto.loginEmail !== user.email) {
          user.email = dto.loginEmail.toLowerCase();
        }
        if (dto.loginPassword) {
          const salt = await bcrypt.genSalt(10);
          user.passwordHash = await bcrypt.hash(dto.loginPassword, salt);
        }
        await this.userRepository.save(user);
      }
    }

    student.updatedAt = new Date();
    return this.studentRepository.save(student);
  }
}
