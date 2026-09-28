import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { StudentOrmEntity } from './student.orm-entity';
import { UserOrmEntity } from './user.orm-entity';

@Entity('student_report_approvals')
@Unique(['studentId', 'reportType', 'periodNumber', 'year'])
export class StudentReportApprovalOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_report_approval_student_id')
  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Column({ type: 'varchar', length: 10, name: 'report_type' })
  reportType!: 'week' | 'month';

  @Column({ type: 'int', name: 'period_number' })
  periodNumber!: number;

  @Column({ type: 'int' })
  year!: number;

  @Index('idx_report_approval_is_approved')
  @Column({ type: 'boolean', name: 'is_approved', default: false })
  isApproved!: boolean;

  @Column({ type: 'uuid', name: 'approved_by_user_id', nullable: true })
  approvedByUserId!: string | null;

  @Column({ type: 'timestamp with time zone', name: 'approved_at', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'timestamp with time zone', name: 'sent_to_zalo_at', nullable: true })
  sentToZaloAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  commendation!: string | null;

  @Column({ type: 'text', nullable: true })
  suggestion!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => StudentOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentOrmEntity;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedByUser!: UserOrmEntity | null;
}
