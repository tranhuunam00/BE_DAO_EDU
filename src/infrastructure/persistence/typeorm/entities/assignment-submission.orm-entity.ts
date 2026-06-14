import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssignmentOrmEntity } from './assignment.orm-entity';
import { StudentOrmEntity } from './student.orm-entity';
import { TeacherOrmEntity } from './teacher.orm-entity';

@Entity('assignment_submissions')
export class AssignmentSubmissionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'assignment_id' })
  assignmentId!: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Column({ type: 'text', name: 'answer_text', nullable: true })
  answerText!: string | null;

  @Column({ type: 'varchar', default: 'submitted' })
  status!: 'submitted' | 'late' | 'graded';

  @Column({ type: 'timestamp with time zone', name: 'submitted_at' })
  submittedAt!: Date;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  score!: number | null;

  @Column({ type: 'text', nullable: true })
  feedback!: string | null;

  @Column({ type: 'uuid', name: 'graded_by_teacher_id', nullable: true })
  gradedByTeacherId!: string | null;

  @Column({
    type: 'timestamp with time zone',
    name: 'graded_at',
    nullable: true,
  })
  gradedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => AssignmentOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment!: AssignmentOrmEntity;

  @ManyToOne(() => StudentOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentOrmEntity;

  @ManyToOne(() => TeacherOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'graded_by_teacher_id' })
  gradedByTeacher!: TeacherOrmEntity | null;
}
