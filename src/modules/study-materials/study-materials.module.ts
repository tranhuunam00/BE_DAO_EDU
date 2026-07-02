import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudyMaterialOrmEntity } from '../../infrastructure/persistence/typeorm/entities/study-material.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { StudyMaterialController } from '../../presentation/controllers/study-material.controller';

@Module({
  imports: [
    StorageModule,
    TypeOrmModule.forFeature([
      StudyMaterialOrmEntity,
      ClassOrmEntity,
      ClassStudentOrmEntity,
      ClassSessionOrmEntity,
      TeacherOrmEntity,
      StudentOrmEntity,
    ]),
  ],
  controllers: [StudyMaterialController],
})
export class StudyMaterialsModule {}
