import { Injectable, NotFoundException } from '@nestjs/common';
import { Student } from '../../domain/entities/student.entity';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';

@Injectable()
export class GetStudentByIdUseCase {
  constructor(private readonly studentRepository: IStudentRepository) {}

  async execute(id: string): Promise<Student> {
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`Không tìm thấy học sinh với ID: ${id}`);
    }
    return student;
  }
}
