import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentAttachmentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/assignment-attachment.orm-entity';
import { AssignmentSubmissionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/assignment-submission.orm-entity';
import { AssignmentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/assignment.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { NotificationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { SubmissionAttachmentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/submission-attachment.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AssignmentController } from '../../presentation/controllers/assignment.controller';

@Module({
  imports: [
    StorageModule,
    TypeOrmModule.forFeature([
      AssignmentOrmEntity,
      AssignmentAttachmentOrmEntity,
      AssignmentSubmissionOrmEntity,
      SubmissionAttachmentOrmEntity,
      ClassOrmEntity,
      ClassStudentOrmEntity,
      ClassSessionOrmEntity,
      TeacherOrmEntity,
      StudentOrmEntity,
      NotificationOrmEntity,
    ]),
  ],
  controllers: [AssignmentController],
})
export class AssignmentsModule {}
