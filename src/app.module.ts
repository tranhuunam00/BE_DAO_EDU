import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { AddStudentUseCase } from './application/use-cases/add-student.use-case';
import { GetStudentsUseCase } from './application/use-cases/get-students.use-case';
import { IUserRepository } from './domain/repositories/user-repository.interface';
import { IStudentRepository } from './domain/repositories/student-repository.interface';
import { AuthController } from './presentation/controllers/auth.controller';
import { DashboardController } from './presentation/controllers/dashboard.controller';
import { StudentController } from './presentation/controllers/student.controller';

// TypeORM Infrastructure
import { UserOrmEntity } from './infrastructure/persistence/typeorm/entities/user.orm-entity';
import { StudentOrmEntity } from './infrastructure/persistence/typeorm/entities/student.orm-entity';
import { RoleOrmEntity } from './infrastructure/persistence/typeorm/entities/role.orm-entity';
import { PermissionOrmEntity } from './infrastructure/persistence/typeorm/entities/permission.orm-entity';
import { TeacherOrmEntity } from './infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-user.repository';
import { TypeOrmStudentRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-student.repository';

@Module({
  imports: [
    // Load .env configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // TypeORM PostgreSQL connection configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5435),
        username: config.get<string>('DATABASE_USER', 'dao_edu_db_admin'),
        password: config.get<string>('DATABASE_PASSWORD', 'P@ssw0rd_Edu_Dao_2026_Secure!'),
        database: config.get<string>('DATABASE_NAME', 'dao_edu_db'),
        entities: [
          UserOrmEntity,
          StudentOrmEntity,
          TeacherOrmEntity,
          RoleOrmEntity,
          PermissionOrmEntity,
        ],
        synchronize: false, // Vô hiệu hóa tự động tạo bảng trực tiếp (Dùng migrations thay thế)
        migrationsRun: true, // Tự động chạy các file migrations chưa chạy khi start app
        migrations: [
          // Thêm các file migrations để NestJS tìm thấy khi chạy build
          __dirname + '/infrastructure/persistence/typeorm/migrations/*.{js,ts}'
        ]
      }),
    }),
    
    TypeOrmModule.forFeature([
      UserOrmEntity,
      StudentOrmEntity,
      TeacherOrmEntity,
      RoleOrmEntity,
      PermissionOrmEntity,
    ]),

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
      useClass: TypeOrmUserRepository,
    },
    {
      provide: IStudentRepository,
      useClass: TypeOrmStudentRepository,
    },
  ],
})
export class AppModule {}
