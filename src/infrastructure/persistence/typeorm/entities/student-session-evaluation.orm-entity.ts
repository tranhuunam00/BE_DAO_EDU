import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ClassSessionOrmEntity } from './class-session.orm-entity';
import { StudentOrmEntity } from './student.orm-entity';
import { TeacherOrmEntity } from './teacher.orm-entity';

@Entity('student_session_evaluations')
export class StudentSessionEvaluationOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_eval_class_session_id')
  @Column({ type: 'uuid', name: 'class_session_id' })
  classSessionId!: string;

  @Index('idx_eval_student_id')
  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Column({ type: 'uuid', name: 'teacher_id', nullable: true })
  teacherId!: string | null;

  @Column({ type: 'varchar', length: 20, name: 'homework_status', default: 'completed' })
  homeworkStatus!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  participation!: string;

  @Column({ type: 'varchar', length: 20, default: 'understood' })
  understanding!: string;

  @Column('text', { array: true, name: 'behavior_tags', default: '{}' })
  behaviorTags!: string[];

  @Column({ type: 'varchar', length: 10, nullable: true })
  score!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'boolean', name: 'is_ai_generated', default: false })
  isAiGenerated!: boolean;

  @Index('idx_eval_is_approved')
  @Column({ type: 'boolean', name: 'is_approved', default: false })
  isApproved!: boolean;

  @Column({ type: 'timestamp with time zone', name: 'approved_at', nullable: true })
  approvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => ClassSessionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_session_id' })
  classSession!: ClassSessionOrmEntity;

  @ManyToOne(() => StudentOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentOrmEntity;

  @ManyToOne(() => TeacherOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teacher_id' })
  teacher!: TeacherOrmEntity | null;
}
