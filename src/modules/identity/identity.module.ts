import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { RoleOrmEntity } from '../../infrastructure/persistence/typeorm/entities/role.orm-entity';
import { UserOrmEntity } from '../../infrastructure/persistence/typeorm/entities/user.orm-entity';
import { TypeOrmUserRepository } from '../../infrastructure/persistence/typeorm/repositories/typeorm-user.repository';
import { AuthController } from '../../presentation/controllers/auth.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity, RoleOrmEntity])],
  controllers: [AuthController],
  providers: [
    RegisterUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    { provide: IUserRepository, useClass: TypeOrmUserRepository },
  ],
  exports: [IUserRepository],
})
export class IdentityModule {}
