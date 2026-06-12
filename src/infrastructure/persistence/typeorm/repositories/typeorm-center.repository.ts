import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Center } from '../../../../domain/entities/center.entity';
import { ICenterRepository, GetCentersQuery } from '../../../../domain/repositories/center-repository.interface';
import { CenterOrmEntity } from '../entities/center.orm-entity';
import { CenterMapper } from '../mappers/center.mapper';

@Injectable()
export class TypeOrmCenterRepository implements ICenterRepository {
  constructor(
    @InjectRepository(CenterOrmEntity)
    private readonly repository: Repository<CenterOrmEntity>,
  ) {}

  async save(center: Center): Promise<Center> {
    const orm = CenterMapper.toOrm(center);
    if (!orm) throw new Error('Cannot map Center to ORM');
    const saved = await this.repository.save(orm);
    const domain = CenterMapper.toDomain(saved);
    if (!domain) throw new Error('Cannot map saved Center to Domain');
    return domain;
  }

  async findAll(): Promise<Center[]> {
    const orms = await this.repository.find({ order: { createdAt: 'DESC' } });
    return orms.map(CenterMapper.toDomain).filter((c): c is Center => c !== null);
  }

  async findPaginated(query: GetCentersQuery): Promise<{ centers: Center[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.repository.createQueryBuilder('center');

    if (query.search) {
      const searchLower = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(center.name) LIKE :search OR LOWER(center.center_id) LIKE :search OR center.phone LIKE :search OR LOWER(center.email) LIKE :search)',
        { search: searchLower }
      );
    }

    if (query.status) {
      qb.andWhere('center.status = :status', { status: query.status });
    }

    if (query.province) {
      qb.andWhere('center.province = :province', { province: query.province });
    }

    qb.orderBy('center.createdAt', 'DESC');
    qb.skip(skip);
    qb.take(limit);

    const [orms, total] = await qb.getManyAndCount();
    const centers = orms.map(CenterMapper.toDomain).filter((c): c is Center => c !== null);

    return { centers, total };
  }

  async findById(id: string): Promise<Center | null> {
    const orm = await this.repository.findOne({ where: { id } });
    return CenterMapper.toDomain(orm);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== undefined && result.affected !== null && result.affected > 0;
  }
}
