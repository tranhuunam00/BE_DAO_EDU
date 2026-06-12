import { Injectable } from '@nestjs/common';
import { Teacher } from '../../domain/entities/teacher.entity';
import { ITeacherRepository, GetTeachersQuery } from '../../domain/repositories/teacher-repository.interface';

@Injectable()
export class GetTeachersUseCase {
  constructor(private readonly teacherRepository: ITeacherRepository) {}

  async execute(query: GetTeachersQuery = {}): Promise<{
    teachers: Teacher[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    
    const { teachers, total } = await this.teacherRepository.findPaginated({
      ...query,
      page,
      limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      teachers,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
