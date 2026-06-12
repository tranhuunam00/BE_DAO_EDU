import { Center } from '../../../../domain/entities/center.entity';
import { CenterOrmEntity } from '../entities/center.orm-entity';

export class CenterMapper {
  static toDomain(orm: CenterOrmEntity | null | undefined): Center | null {
    if (!orm) return null;
    return new Center(
      orm.id,
      orm.centerId,
      orm.name,
      orm.phone || undefined,
      orm.email || undefined,
      orm.province || undefined,
      orm.districtWard || undefined,
      orm.primaryAddress || undefined,
      orm.managerName || undefined,
      orm.status,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: Center | null | undefined): CenterOrmEntity | null {
    if (!domain) return null;
    const orm = new CenterOrmEntity();
    orm.id = domain.id;
    orm.centerId = domain.centerId;
    orm.name = domain.name;
    orm.phone = domain.phone ?? null;
    orm.email = domain.email ?? null;
    orm.province = domain.province ?? null;
    orm.districtWard = domain.districtWard ?? null;
    orm.primaryAddress = domain.primaryAddress ?? null;
    orm.managerName = domain.managerName ?? null;
    orm.status = domain.status;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
