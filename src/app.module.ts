import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { AddStudentUseCase } from './application/use-cases/add-student.use-case';
import { GetStudentsUseCase } from './application/use-cases/get-students.use-case';
import { IUserRepository } from './domain/repositories/user-repository.interface';
import { IStudentRepository } from './domain/repositories/student-repository.interface';
import { MockUserRepository } from './infrastructure/persistence/mock-user.repository';
import { MockStudentRepository } from './infrastructure/persistence/mock-student.repository';
import { AuthController } from './presentation/controllers/auth.controller';
import { DashboardController } from './presentation/controllers/dashboard.controller';
import { StudentController } from './presentation/controllers/student.controller';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: 'SUPER_SECRET_KEY_FOR_DEV_ONLY_12345',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [
    AppController, 
    AuthController, 
    DashboardController, 
    StudentController
  ],
  providers: [
    AppService,
    RegisterUseCase,
    LoginUseCase,
    AddStudentUseCase,
    GetStudentsUseCase,
    {
      provide: IUserRepository,
      useClass: MockUserRepository,
    },
    {
      provide: IStudentRepository,
      useClass: MockStudentRepository,
    },
  ],
})
export class AppModule {}
