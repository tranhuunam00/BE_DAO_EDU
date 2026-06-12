import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../../../domain/entities/student.entity';
import { IStudentRepository } from '../../../../domain/repositories/student-repository.interface';
import { StudentOrmEntity } from '../entities/student.orm-entity';
import { StudentMapper } from '../mappers/student.mapper';

@Injectable()
export class TypeOrmStudentRepository implements IStudentRepository {
  constructor(
    @InjectRepository(StudentOrmEntity)
    private readonly repository: Repository<StudentOrmEntity>,
  ) {}

  async save(student: Student): Promise<Student> {
    const orm = StudentMapper.toOrm(student);
    if (!orm) {
      throw new Error('Không thể map Student sang ORM Entity');
    }
    const saved = await this.repository.save(orm);
    const domain = StudentMapper.toDomain(saved);
    if (!domain) {
      throw new Error('Không thể map saved Student sang Domain');
    }
    return domain;
  }

  async findAll(): Promise<Student[]> {
    const orms = await this.repository.find({
      order: { createdAt: 'DESC' },
    });
    return orms
      .map(StudentMapper.toDomain)
      .filter((s): s is Student => s !== null);
  }

  async findById(id: string): Promise<Student | null> {
    const orm = await this.repository.findOne({ where: { id } });
    return StudentMapper.toDomain(orm);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== undefined && result.affected !== null && result.affected > 0;
  }
}
