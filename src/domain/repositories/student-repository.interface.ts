import { Student } from '../entities/student.entity';

export interface GetStudentsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  province?: string;
  noClass?: boolean | string;
}

export abstract class IStudentRepository {
  abstract save(student: Student): Promise<Student>;
  abstract findAll(): Promise<Student[]>;
  abstract findPaginated(query: GetStudentsQuery): Promise<{ students: Student[]; total: number }>;
  abstract findById(id: string): Promise<Student | null>;
  abstract delete(id: string): Promise<boolean>;
}
