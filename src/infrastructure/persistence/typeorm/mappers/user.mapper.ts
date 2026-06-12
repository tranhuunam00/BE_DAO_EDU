import { User } from '../../../../domain/entities/user.entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { Role } from '../../../../domain/value-objects/role.enum';
import { RoleOrmEntity } from '../entities/role.orm-entity';

export class UserMapper {
  static toDomain(orm: UserOrmEntity | null | undefined): User | null {
    if (!orm) return null;
    return new User(
      orm.id,
      orm.email,
      orm.passwordHash,
      orm.name,
      orm.role ? (orm.role.name as Role) : Role.STUDENT,
      orm.isActive,
    );
  }

  static toOrm(domain: User | null | undefined, roleOrm?: RoleOrmEntity | null): UserOrmEntity | null {
    if (!domain) return null;
    const orm = new UserOrmEntity();
    orm.id = domain.id;
    orm.email = domain.email;
    orm.passwordHash = domain.passwordHash;
    orm.name = domain.name;
    orm.isActive = domain.isActive;
    if (roleOrm) {
      orm.role = roleOrm;
    }
    return orm;
  }
}
