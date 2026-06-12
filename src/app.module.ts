import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { AddStudentUseCase } from './application/use-cases/add-student.use-case';
import { GetStudentsUseCase } from './application/use-cases/get-students.use-case';
import { GetStudentByIdUseCase } from './application/use-cases/get-student-by-id.use-case';
import { UpdateStudentUseCase } from './application/use-cases/update-student.use-case';
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
import { MinioService } from './infrastructure/storage/minio.service';
import { CenterOrmEntity } from './infrastructure/persistence/typeorm/entities/center.orm-entity';
import { RoomOrmEntity } from './infrastructure/persistence/typeorm/entities/room.orm-entity';
import { CourseOrmEntity } from './infrastructure/persistence/typeorm/entities/course.orm-entity';
import { CourseLevelOrmEntity } from './infrastructure/persistence/typeorm/entities/course-level.orm-entity';
import { CourseLevelPricingOrmEntity } from './infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { ClassOrmEntity } from './infrastructure/persistence/typeorm/entities/class.orm-entity';
import { ClassScheduleOrmEntity } from './infrastructure/persistence/typeorm/entities/class-schedule.orm-entity';
import { ClassSessionOrmEntity } from './infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from './infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { StudentAttendanceOrmEntity } from './infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { TypeOrmTeacherRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-teacher.repository';
import { TypeOrmCenterRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-center.repository';
import { ITeacherRepository } from './domain/repositories/teacher-repository.interface';
import { ICenterRepository } from './domain/repositories/center-repository.interface';
import { AddTeacherUseCase } from './application/use-cases/add-teacher.use-case';
import { GetTeachersUseCase } from './application/use-cases/get-teachers.use-case';
import { GetTeacherByIdUseCase } from './application/use-cases/get-teacher-by-id.use-case';
import { UpdateTeacherUseCase } from './application/use-cases/update-teacher.use-case';
import { AddCenterUseCase } from './application/use-cases/add-center.use-case';
import { GetCentersUseCase } from './application/use-cases/get-centers.use-case';
import { GetCenterByIdUseCase } from './application/use-cases/get-center-by-id.use-case';
import { UpdateCenterUseCase } from './application/use-cases/update-center.use-case';
import { TeacherController } from './presentation/controllers/teacher.controller';
import { CenterController } from './presentation/controllers/center.controller';
import { CourseController } from './presentation/controllers/course.controller';
import { RoomController } from './presentation/controllers/room.controller';
import { ClassController } from './presentation/controllers/class.controller';

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
          CenterOrmEntity,
          RoomOrmEntity,
          CourseOrmEntity,
          CourseLevelOrmEntity,
          CourseLevelPricingOrmEntity,
          ClassOrmEntity,
          ClassScheduleOrmEntity,
          ClassSessionOrmEntity,
          ClassStudentOrmEntity,
          StudentAttendanceOrmEntity,
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
      CenterOrmEntity,
      RoomOrmEntity,
      CourseOrmEntity,
      CourseLevelOrmEntity,
      CourseLevelPricingOrmEntity,
      ClassOrmEntity,
      ClassScheduleOrmEntity,
      ClassSessionOrmEntity,
      ClassStudentOrmEntity,
      StudentAttendanceOrmEntity,
    ]),

    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'SUPER_SECRET_KEY_FOR_DEV_ONLY_12345'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [
    AppController, 
    AuthController, 
    DashboardController, 
    StudentController,
    TeacherController,
    CenterController,
    CourseController,
    RoomController,
    ClassController,
  ],
  providers: [
    AppService,
    RegisterUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    AddStudentUseCase,
    GetStudentsUseCase,
    GetStudentByIdUseCase,
    UpdateStudentUseCase,
    AddTeacherUseCase,
    GetTeachersUseCase,
    GetTeacherByIdUseCase,
    UpdateTeacherUseCase,
    AddCenterUseCase,
    GetCentersUseCase,
    GetCenterByIdUseCase,
    UpdateCenterUseCase,
    MinioService,
    {
      provide: IUserRepository,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: IStudentRepository,
      useClass: TypeOrmStudentRepository,
    },
    {
      provide: ITeacherRepository,
      useClass: TypeOrmTeacherRepository,
    },
    {
      provide: ICenterRepository,
      useClass: TypeOrmCenterRepository,
    },
  ],
})
export class AppModule {}
