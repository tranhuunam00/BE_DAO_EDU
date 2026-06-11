import { Injectable, OnModuleInit } from '@nestjs/common';
import { Student } from '../../domain/entities/student.entity';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';

@Injectable()
export class MockStudentRepository implements IStudentRepository, OnModuleInit {
  private students: Map<string, Student> = new Map();

  async onModuleInit() {
    // Seed initial students
    const student1 = new Student(
      'STU-1001',
      'Minh',
      'Nguyễn Bình',
      'Minh Còi',
      'Nam',
      '0987654321',
      'binhminh@gmail.com',
      '2015-08-14',
      'Nguyễn Văn Hùng',
      'Bố',
      '046095001234',
      'Waiting for class',
      'Thành phố Huế, Việt Nam',
      'Học sinh hiếu động, chăm ngoan',
    );

    const student2 = new Student(
      'STU-1002',
      'Vy',
      'Lê Phương',
      'Vy Vy',
      'Nữ',
      '0912345678',
      'phuongvy@gmail.com',
      '2016-04-22',
      'Lê Thị Lan',
      'Mẹ',
      '046096005678',
      'Studying',
      'Thành phố Huế, Việt Nam',
      'Có năng khiếu vẽ tranh',
    );

    this.students.set(student1.id, student1);
    this.students.set(student2.id, student2);
  }

  async save(student: Student): Promise<Student> {
    this.students.set(student.id, student);
    return student;
  }

  async findAll(): Promise<Student[]> {
    return Array.from(this.students.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async findById(id: string): Promise<Student | null> {
    const student = this.students.get(id);
    return student || null;
  }

  async delete(id: string): Promise<boolean> {
    return this.students.delete(id);
  }
}
