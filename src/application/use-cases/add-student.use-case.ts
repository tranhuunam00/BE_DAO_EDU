import { Injectable } from '@nestjs/common';
import { Student } from '../../domain/entities/student.entity';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';
import { CreateStudentDto } from '../dtos/student.dto';

@Injectable()
export class AddStudentUseCase {
  constructor(
    private readonly studentRepository: IStudentRepository,
  ) {}

  async execute(dto: CreateStudentDto): Promise<Student> {
    // Generate unique student ID format: STU-XXXX
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const id = `STU-${randomNum}`;

    const student = new Student(
      id,
      dto.firstName,
      dto.lastName,
      dto.nickName,
      dto.gender,
      dto.mobile,
      dto.email,
      dto.birthdate,
      dto.parentName,
      dto.relationship,
      dto.citizenId,
      dto.status,
      dto.primaryAddress,
      dto.description,
    );

    return this.studentRepository.save(student);
  }
}
