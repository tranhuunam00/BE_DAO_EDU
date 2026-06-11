import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/value-objects/role.enum';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';

@Injectable()
export class MockUserRepository implements IUserRepository, OnModuleInit {
  private users: Map<string, User> = new Map();

  async onModuleInit() {
    const salt = await bcrypt.genSalt(10);

    const adminHash = await bcrypt.hash('admin123', salt);
    const teacherHash = await bcrypt.hash('teacher123', salt);
    const studentHash = await bcrypt.hash('student123', salt);

    // 1. Admin
    const admin = new User(
      'admin-id-1',
      'admin@class.com',
      adminHash,
      'Hiệu Trưởng / Quản Trị',
      Role.ADMIN,
    );

    // 2. Teacher (Giáo viên)
    const teacher = new User(
      'teacher-id-1',
      'teacher@class.com',
      teacherHash,
      'Cô giáo Nguyễn Thị Mai',
      Role.TEACHER,
      'Toán học sơ cấp',
      'GV-9988',
    );

    // 3. Student (Học sinh)
    const student = new User(
      'student-id-1',
      'student@class.com',
      studentHash,
      'Học sinh Trần Văn Tú',
      Role.STUDENT,
      undefined,
      undefined,
      '2010-09-05',
      'Lớp 10A1',
    );

    this.users.set(admin.id, admin);
    this.users.set(teacher.id, teacher);
    this.users.set(student.id, student);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    return user || null;
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user || null;
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}
