import { Student } from '../../../../domain/entities/student.entity';
import { StudentOrmEntity } from '../entities/student.orm-entity';

export class StudentMapper {
  static toDomain(orm: StudentOrmEntity | null | undefined): Student | null {
    if (!orm) return null;
    return new Student(
      orm.id,
      orm.studentId,
      orm.firstName,
      orm.lastName,
      orm.nickName || undefined,
      orm.gender,
      orm.mobile,
      orm.email || undefined,
      orm.birthdate,
      orm.parentGuardian1 || undefined,
      orm.parentGuardian2 || undefined,
      orm.parent1CitizenId || undefined,
      orm.parent2CitizenId || undefined,
      orm.studentCitizenId || undefined,
      orm.relationship1 || undefined,
      orm.relationship2 || undefined,
      orm.otherPhone1 || undefined,
      orm.otherPhone2 || undefined,
      orm.description || undefined,
      orm.country || undefined,
      orm.province || undefined,
      orm.districtWard || undefined,
      orm.primaryAddress,
      orm.oldAddress || undefined,
      orm.status,
      orm.userId || undefined,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: Student | null | undefined): StudentOrmEntity | null {
    if (!domain) return null;
    const orm = new StudentOrmEntity();
    orm.id = domain.id;
    orm.studentId = domain.studentId;
    orm.firstName = domain.firstName;
    orm.lastName = domain.lastName;
    orm.nickName = domain.nickName ?? null;
    orm.gender = domain.gender;
    orm.mobile = domain.mobile;
    orm.email = domain.email ?? null;
    orm.birthdate = domain.birthdate;
    orm.parentGuardian1 = domain.parentGuardian1 ?? null;
    orm.parentGuardian2 = domain.parentGuardian2 ?? null;
    orm.parent1CitizenId = domain.parent1CitizenId ?? null;
    orm.parent2CitizenId = domain.parent2CitizenId ?? null;
    orm.studentCitizenId = domain.studentCitizenId ?? null;
    orm.relationship1 = domain.relationship1 ?? null;
    orm.relationship2 = domain.relationship2 ?? null;
    orm.otherPhone1 = domain.otherPhone1 ?? null;
    orm.otherPhone2 = domain.otherPhone2 ?? null;
    orm.description = domain.description ?? null;
    orm.country = domain.country ?? null;
    orm.province = domain.province ?? null;
    orm.districtWard = domain.districtWard ?? null;
    orm.primaryAddress = domain.primaryAddress;
    orm.oldAddress = domain.oldAddress ?? null;
    orm.status = domain.status;
    orm.userId = domain.userId ?? null;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
