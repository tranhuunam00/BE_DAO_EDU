import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from '../../../../domain/entities/teacher.entity';
import { ITeacherRepository, GetTeachersQuery } from '../../../../domain/repositories/teacher-repository.interface';
import { TeacherOrmEntity } from '../entities/teacher.orm-entity';
import { TeacherMapper } from '../mappers/teacher.mapper';

@Injectable()
export class TypeOrmTeacherRepository implements ITeacherRepository {
  constructor(
    @InjectRepository(TeacherOrmEntity)
    private readonly repository: Repository<TeacherOrmEntity>,
  ) {}

  async save(teacher: Teacher): Promise<Teacher> {
    const orm = TeacherMapper.toOrm(teacher);
    if (!orm) throw new Error('Cannot map Teacher to ORM');
    const saved = await this.repository.save(orm);
    const domain = TeacherMapper.toDomain(saved);
    if (!domain) throw new Error('Cannot map saved Teacher to Domain');
    return domain;
  }

  async findAll(): Promise<Teacher[]> {
    const orms = await this.repository.find({ order: { createdAt: 'DESC' } });
    return orms.map(TeacherMapper.toDomain).filter((t): t is Teacher => t !== null);
  }

  async findPaginated(query: GetTeachersQuery): Promise<{ teachers: Teacher[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.repository.createQueryBuilder('teacher');

    if (query.search) {
      const searchLower = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(teacher.first_name) LIKE :search OR LOWER(teacher.last_name) LIKE :search OR LOWER(teacher.teacher_id) LIKE :search OR teacher.mobile LIKE :search OR LOWER(teacher.email) LIKE :search)',
        { search: searchLower }
      );
    }

    if (query.status) {
      qb.andWhere('teacher.status = :status', { status: query.status });
    }

    if (query.type) {
      qb.andWhere('teacher.type = :type', { type: query.type });
    }

    if (query.province) {
      qb.andWhere('teacher.province = :province', { province: query.province });
    }

    qb.orderBy('teacher.createdAt', 'DESC');
    qb.skip(skip);
    qb.take(limit);

    const [orms, total] = await qb.getManyAndCount();
    const teachers = orms.map(TeacherMapper.toDomain).filter((t): t is Teacher => t !== null);

    return { teachers, total };
  }

  async findById(id: string): Promise<Teacher | null> {
    const orm = await this.repository.findOne({ where: { id }, relations: { user: true } });
    return TeacherMapper.toDomain(orm);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== undefined && result.affected !== null && result.affected > 0;
  }
}
