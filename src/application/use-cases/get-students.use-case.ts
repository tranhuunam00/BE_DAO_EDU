import { Injectable } from '@nestjs/common';
import { Student } from '../../domain/entities/student.entity';
import { IStudentRepository, GetStudentsQuery } from '../../domain/repositories/student-repository.interface';

@Injectable()
export class GetStudentsUseCase {
  constructor(
    private readonly studentRepository: IStudentRepository,
  ) {}

  async execute(query: GetStudentsQuery = {}): Promise<{
    students: Student[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    
    const { students, total } = await this.studentRepository.findPaginated({
      ...query,
      page,
      limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      students,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
