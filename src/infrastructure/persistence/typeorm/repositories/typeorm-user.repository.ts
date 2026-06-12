import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../../domain/entities/user.entity';
import { IUserRepository } from '../../../../domain/repositories/user-repository.interface';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { RoleOrmEntity } from '../entities/role.orm-entity';
import { UserMapper } from '../mappers/user.mapper';

@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: Repository<UserOrmEntity>,
    @InjectRepository(RoleOrmEntity)
    private readonly roleRepository: Repository<RoleOrmEntity>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const orm = await this.repository.findOne({
      where: { email: email.toLowerCase() },
      relations: { role: true },
    });
    return UserMapper.toDomain(orm);
  }

  async findById(id: string): Promise<User | null> {
    const orm = await this.repository.findOne({
      where: { id },
      relations: { role: true },
    });
    return UserMapper.toDomain(orm);
  }

  async save(user: User): Promise<User> {
    let roleOrm: RoleOrmEntity | null = null;
    if (user.role) {
      roleOrm = await this.roleRepository.findOne({
        where: { name: user.role.toString() },
      });
      if (!roleOrm) {
        roleOrm = new RoleOrmEntity();
        roleOrm.name = user.role.toString();
        roleOrm = await this.roleRepository.save(roleOrm);
      }
    }

    const orm = UserMapper.toOrm(user, roleOrm);
    if (!orm) {
      throw new Error('Không thể map User sang ORM Entity');
    }
    const saved = await this.repository.save(orm);
    const domain = UserMapper.toDomain(saved);
    if (!domain) {
      throw new Error('Không thể map saved User sang Domain');
    }
    return domain;
  }

  async findAll(): Promise<User[]> {
    const orms = await this.repository.find({
      relations: { role: true },
    });
    return orms
      .map(UserMapper.toDomain)
      .filter((u): u is User => u !== null);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== undefined && result.affected !== null && result.affected > 0;
  }
}
