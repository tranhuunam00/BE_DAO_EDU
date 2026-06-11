import { Student } from '../entities/student.entity';

export abstract class IStudentRepository {
  abstract save(student: Student): Promise<Student>;
  abstract findAll(): Promise<Student[]>;
  abstract findById(id: string): Promise<Student | null>;
  abstract delete(id: string): Promise<boolean>;
}
