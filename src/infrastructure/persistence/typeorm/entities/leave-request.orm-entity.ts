import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClassSessionOrmEntity } from './class-session.orm-entity';
import { StudentOrmEntity } from './student.orm-entity';
import { UserOrmEntity } from './user.orm-entity';

@Entity('leave_requests')
export class LeaveRequestOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Column({ type: 'uuid', name: 'class_session_id' })
  classSessionId!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: string;

  @Column({ type: 'timestamp with time zone', name: 'submitted_at' })
  submittedAt!: Date;

  @Column({
    type: 'timestamp with time zone',
    name: 'reviewed_at',
    nullable: true,
  })
  reviewedAt!: Date | null;

  @Column({ type: 'uuid', name: 'reviewed_by_user_id', nullable: true })
  reviewedByUserId!: string | null;

  @Column({ type: 'text', name: 'review_note', nullable: true })
  reviewNote!: string | null;

  @Column({
    type: 'timestamp with time zone',
    name: 'cancelled_at',
    nullable: true,
  })
  cancelledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => StudentOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentOrmEntity;

  @ManyToOne(() => ClassSessionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_session_id' })
  classSession!: ClassSessionOrmEntity;

  @ManyToOne(() => UserOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedByUser!: UserOrmEntity | null;
}
