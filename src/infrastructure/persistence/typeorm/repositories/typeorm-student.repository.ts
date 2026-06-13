import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../../../domain/entities/student.entity';
import { IStudentRepository, GetStudentsQuery } from '../../../../domain/repositories/student-repository.interface';
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
    const fullyLoaded = await this.findById(saved.id);
    if (!fullyLoaded) {
      throw new Error('Không thể load lại Student từ database sau khi save');
    }
    return fullyLoaded;
  }

  async findAll(): Promise<Student[]> {
    const orms = await this.repository.find({
      order: { createdAt: 'DESC' },
    });
    return orms
      .map(StudentMapper.toDomain)
      .filter((s): s is Student => s !== null);
  }

  async findPaginated(query: GetStudentsQuery): Promise<{ students: Student[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.repository.createQueryBuilder('student');

    if (query.search) {
      const searchLower = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(student.first_name) LIKE :search OR LOWER(student.last_name) LIKE :search OR LOWER(student.student_id) LIKE :search OR student.mobile LIKE :search OR LOWER(student.email) LIKE :search)',
        { search: searchLower }
      );
    }

    if (query.status) {
      qb.andWhere('student.status = :status', { status: query.status });
    }

    if (query.province) {
      qb.andWhere('student.province = :province', { province: query.province });
    }

    qb.orderBy('student.createdAt', 'DESC'); // Sử dụng trường camelCase do TypeORM tự map sang snake_case
    qb.skip(skip);
    qb.take(limit);

    const [orms, total] = await qb.getManyAndCount();
    const students = orms
      .map(StudentMapper.toDomain)
      .filter((s): s is Student => s !== null);

    return { students, total };
  }

  async findById(id: string): Promise<Student | null> {
    const orm = await this.repository.findOne({ where: { id }, relations: { user: true } });
    return StudentMapper.toDomain(orm);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== undefined && result.affected !== null && result.affected > 0;
  }
}
