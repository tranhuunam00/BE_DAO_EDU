import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddStudentUseCase } from '../../application/use-cases/add-student.use-case';
import { FileStoragePort } from '../../application/ports/file-storage.port';
import { GetStudentByIdUseCase } from '../../application/use-cases/get-student-by-id.use-case';
import { GetStudentsUseCase } from '../../application/use-cases/get-students.use-case';
import { UpdateStudentUseCase } from '../../application/use-cases/update-student.use-case';
import { IStudentRepository } from '../../domain/repositories/student-repository.interface';
import { IUserRepository } from '../../domain/repositories/user-repository.interface';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { StudentMonthlyBillItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill-item.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { TypeOrmStudentRepository } from '../../infrastructure/persistence/typeorm/repositories/typeorm-student.repository';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { StudentController } from '../../presentation/controllers/student.controller';
import { IdentityModule } from '../identity/identity.module';
import { BillingModule } from '../billing/billing.module';

import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { UserOrmEntity } from '../../infrastructure/persistence/typeorm/entities/user.orm-entity';

@Module({
  imports: [
    IdentityModule,
    StorageModule,
    BillingModule,
    TypeOrmModule.forFeature([
      StudentOrmEntity,
      ClassStudentOrmEntity,
      ClassSessionOrmEntity,
      StudentMonthlyBillOrmEntity,
      StudentMonthlyBillItemOrmEntity,
      StudentAttendanceOrmEntity,
      UserOrmEntity,
    ]),
  ],
  controllers: [StudentController],
  providers: [
    GetStudentsUseCase,
    GetStudentByIdUseCase,
    { provide: IStudentRepository, useClass: TypeOrmStudentRepository },
    {
      provide: AddStudentUseCase,
      useFactory: (
        students: IStudentRepository,
        users: IUserRepository,
        storage: FileStoragePort,
      ) => new AddStudentUseCase(students, users, storage),
      inject: [IStudentRepository, IUserRepository, FileStoragePort],
    },
    {
      provide: UpdateStudentUseCase,
      useFactory: (
        students: IStudentRepository,
        users: IUserRepository,
        storage: FileStoragePort,
      ) => new UpdateStudentUseCase(students, users, storage),
      inject: [IStudentRepository, IUserRepository, FileStoragePort],
    },
  ],
})
export class StudentsModule {}
