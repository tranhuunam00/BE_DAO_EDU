import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { UpdateStudentDto } from '../dtos/student.dto';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/value-objects/role.enum';
import { Student } from '../../domain/entities/student.entity';
import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { FileStoragePort } from '../ports/file-storage.port';

@Injectable()
export class UpdateStudentUseCase {
  constructor(
    private readonly studentRepository: IStudentRepository,
    private readonly userRepository: IUserRepository,
    private readonly fileStorage: FileStoragePort,
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
        student.avatar = await this.fileStorage.uploadBase64Image(
          dto.avatar,
          'avatars',
        );
      } else {
        student.avatar = dto.avatar;
      }
    }

    // Cập nhật hoặc tạo mới thông tin tài khoản đăng nhập
    if (dto.loginEmail) {
      if (student.userId) {
        const user = await this.userRepository.findById(student.userId);
        if (user) {
          const allStudents = await this.studentRepository.findAll();
          const siblingsCount = allStudents.filter(s => s.userId === student.userId).length;
          
          if (dto.loginEmail.toLowerCase() !== user.email.toLowerCase()) {
            const existingUser = await this.userRepository.findByEmail(dto.loginEmail);
            
            if (siblingsCount > 1) {
              // Tách tài khoản (Account Splitting) để không ảnh hưởng đến các anh chị em
              if (existingUser) {
                // Liên kết với tài khoản có sẵn
                student.userId = existingUser.id;
                student.loginEmail = existingUser.email;
                if (dto.loginPassword) {
                  const salt = await bcrypt.genSalt(10);
                  existingUser.passwordHash = await bcrypt.hash(dto.loginPassword, salt);
                  await this.userRepository.save(existingUser);
                }
              } else {
                // Tạo tài khoản mới hoàn toàn
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(dto.loginPassword || 'student123', salt);
                const newUserId = randomUUID();
                const newUser = new User(
                  newUserId,
                  dto.loginEmail.toLowerCase(),
                  passwordHash,
                  student.getFullName(),
                  Role.STUDENT,
                  true
                );
                const savedUser = await this.userRepository.save(newUser);
                student.userId = savedUser.id;
                student.loginEmail = savedUser.email;
              }
            } else {
              // Tài khoản riêng biệt, có thể thay đổi trực tiếp
              if (existingUser) {
                // Nếu email mới trùng với một tài khoản khác đã có:
                // Xóa tài khoản cũ của học sinh này (vì không ai dùng nữa) và liên kết với tài khoản đã có
                const oldUserId = student.userId;
                student.userId = existingUser.id;
                student.loginEmail = existingUser.email;
                await this.userRepository.delete(oldUserId);
                if (dto.loginPassword) {
                  const salt = await bcrypt.genSalt(10);
                  existingUser.passwordHash = await bcrypt.hash(dto.loginPassword, salt);
                  await this.userRepository.save(existingUser);
                }
              } else {
                // Cập nhật trực tiếp trên tài khoản cũ
                user.email = dto.loginEmail.toLowerCase();
                if (dto.loginPassword) {
                  const salt = await bcrypt.genSalt(10);
                  user.passwordHash = await bcrypt.hash(dto.loginPassword, salt);
                }
                await this.userRepository.save(user);
                student.loginEmail = user.email;
              }
            }
          } else {
            // Không thay đổi email, chỉ cập nhật mật khẩu nếu có
            if (dto.loginPassword) {
              const salt = await bcrypt.genSalt(10);
              user.passwordHash = await bcrypt.hash(dto.loginPassword, salt);
              await this.userRepository.save(user);
            }
          }
        }
      } else {
        // Tạo account mới cho học sinh chưa có tài khoản
        const existingUser = await this.userRepository.findByEmail(dto.loginEmail);
        if (existingUser) {
          // Liên kết với tài khoản có sẵn
          student.userId = existingUser.id;
          student.loginEmail = existingUser.email;
          if (dto.loginPassword) {
            const salt = await bcrypt.genSalt(10);
            existingUser.passwordHash = await bcrypt.hash(dto.loginPassword, salt);
            await this.userRepository.save(existingUser);
          }
        } else {
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash(dto.loginPassword || 'student123', salt);
          const newUserId = randomUUID();
          const newUser = new User(
            newUserId,
            dto.loginEmail.toLowerCase(),
            passwordHash,
            student.getFullName(),
            Role.STUDENT,
            true
          );
          const savedUser = await this.userRepository.save(newUser);
          student.userId = savedUser.id;
          student.loginEmail = savedUser.email;
        }
      }
    } else if (dto.loginPassword && student.userId) {
      // Đổi mật khẩu nhưng không đổi email
      const user = await this.userRepository.findById(student.userId);
      if (user) {
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(dto.loginPassword, salt);
        await this.userRepository.save(user);
      }
    }

    student.updatedAt = new Date();
    return this.studentRepository.save(student);
  }
}
