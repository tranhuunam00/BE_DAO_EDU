import { Injectable, NotFoundException } from '@nestjs/common';
import { Teacher } from '../../domain/entities/teacher.entity';
import { ITeacherRepository } from '../../domain/repositories/teacher-repository.interface';

@Injectable()
export class GetTeacherByIdUseCase {
  constructor(private readonly teacherRepository: ITeacherRepository) {}

  async execute(id: string): Promise<Teacher> {
    const teacher = await this.teacherRepository.findById(id);
    if (!teacher) {
      throw new NotFoundException('Không tìm thấy giáo viên/trợ giảng');
    }
    return teacher;
  }
}
