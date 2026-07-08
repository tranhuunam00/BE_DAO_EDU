import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddTeacherUseCase } from '../../application/use-cases/add-teacher.use-case';
import { FileStoragePort } from '../../application/ports/file-storage.port';
import { GetTeacherByIdUseCase } from '../../application/use-cases/get-teacher-by-id.use-case';
import { GetTeachersUseCase } from '../../application/use-cases/get-teachers.use-case';
import { UpdateTeacherUseCase } from '../../application/use-cases/update-teacher.use-case';
import { ITeacherRepository } from '../../domain/repositories/teacher-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { TeacherMonthlyWageItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage-item.orm-entity';
import { TeacherMonthlyWageOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { TypeOrmTeacherRepository } from '../../infrastructure/persistence/typeorm/repositories/typeorm-teacher.repository';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { TeacherController } from '../../presentation/controllers/teacher.controller';
import { IdentityModule } from '../identity/identity.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    IdentityModule,
    StorageModule,
    BillingModule,
    TypeOrmModule.forFeature([
      TeacherOrmEntity,
      ClassSessionOrmEntity,
      TeacherMonthlyWageOrmEntity,
      TeacherMonthlyWageItemOrmEntity,
    ]),
  ],
  controllers: [TeacherController],
  providers: [
    GetTeachersUseCase,
    GetTeacherByIdUseCase,
    { provide: ITeacherRepository, useClass: TypeOrmTeacherRepository },
    {
      provide: AddTeacherUseCase,
      useFactory: (
        teachers: ITeacherRepository,
        users: IUserRepository,
        storage: FileStoragePort,
      ) => new AddTeacherUseCase(teachers, users, storage),
      inject: [ITeacherRepository, IUserRepository, FileStoragePort],
    },
    {
      provide: UpdateTeacherUseCase,
      useFactory: (
        teachers: ITeacherRepository,
        users: IUserRepository,
        storage: FileStoragePort,
      ) => new UpdateTeacherUseCase(teachers, users, storage),
      inject: [ITeacherRepository, IUserRepository, FileStoragePort],
    },
  ],
})
export class TeachersModule {}
