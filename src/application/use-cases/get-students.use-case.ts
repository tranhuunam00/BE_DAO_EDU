import { Injectable } from '@nestjs/common';
import { Student } from '../../domain/entities/student.entity';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';

@Injectable()
export class GetStudentsUseCase {
  constructor(
    private readonly studentRepository: IStudentRepository,
  ) {}

  async execute(): Promise<Student[]> {
    return this.studentRepository.findAll();
  }
}
