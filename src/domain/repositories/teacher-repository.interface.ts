import { Teacher } from '../entities/teacher.entity';

export interface GetTeachersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  province?: string;
  type?: string;
}

export abstract class ITeacherRepository {
  abstract save(teacher: Teacher): Promise<Teacher>;
  abstract findAll(): Promise<Teacher[]>;
  abstract findPaginated(query: GetTeachersQuery): Promise<{ teachers: Teacher[]; total: number }>;
  abstract findById(id: string): Promise<Teacher | null>;
  abstract delete(id: string): Promise<boolean>;
}
