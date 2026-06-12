import { Teacher } from '../../../../domain/entities/teacher.entity';
import { TeacherOrmEntity } from '../entities/teacher.orm-entity';

export class TeacherMapper {
  static toDomain(orm: TeacherOrmEntity | null | undefined): Teacher | null {
    if (!orm) return null;
    return new Teacher(
      orm.id,
      orm.teacherId,
      orm.firstName,
      orm.lastName,
      orm.gender,
      orm.birthdate || undefined,
      orm.mobile || undefined,
      orm.email || undefined,
      orm.citizenId || undefined,
      orm.type,
      orm.country || undefined,
      orm.province || undefined,
      orm.districtWard || undefined,
      orm.primaryAddress || undefined,
      orm.status,
      orm.userId || undefined,
      orm.avatar || undefined,
      orm.user ? orm.user.email : undefined,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: Teacher | null | undefined): TeacherOrmEntity | null {
    if (!domain) return null;
    const orm = new TeacherOrmEntity();
    orm.id = domain.id;
    orm.teacherId = domain.teacherId;
    orm.firstName = domain.firstName;
    orm.lastName = domain.lastName;
    orm.gender = domain.gender;
    orm.birthdate = domain.birthdate ?? null;
    orm.mobile = domain.mobile ?? null;
    orm.email = domain.email ?? null;
    orm.citizenId = domain.citizenId ?? null;
    orm.type = domain.type;
    orm.country = domain.country ?? null;
    orm.province = domain.province ?? null;
    orm.districtWard = domain.districtWard ?? null;
    orm.primaryAddress = domain.primaryAddress ?? null;
    orm.status = domain.status;
    orm.userId = domain.userId ?? null;
    orm.avatar = domain.avatar ?? null;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
