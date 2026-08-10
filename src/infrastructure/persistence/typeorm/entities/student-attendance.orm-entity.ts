import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ClassSessionOrmEntity } from './class-session.orm-entity';
import { StudentOrmEntity } from './student.orm-entity';
import { StudentMonthlyBillOrmEntity } from './student-monthly-bill.orm-entity';

@Entity('student_attendance')
export class StudentAttendanceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_student_attendance_class_session_id')
  @Column({ type: 'uuid', name: 'class_session_id' })
  classSessionId!: string;

  @Index('idx_student_attendance_student_id')
  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Index('idx_student_attendance_bill_id')
  @Column({ type: 'uuid', name: 'bill_id', nullable: true })
  billId!: string | null;

  @Column({ type: 'boolean', name: 'is_present', default: false })
  isPresent!: boolean;

  @Column({ type: 'varchar', name: 'attendance_type', default: 'manual' })
  attendanceType!: string; // 'manual' | 'machine'

  @Column({ type: 'varchar', name: 'verify_method', nullable: true })
  verifyMethod!: string | null; // 'face' | 'fingerprint' | 'card' | 'pin'

  @Column({ type: 'boolean', name: 'is_late', default: false })
  isLate!: boolean;

  @Column({ type: 'int', name: 'late_minutes', default: 0 })
  lateMinutes!: number;

  @Column({ type: 'varchar', nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'varchar', name: 'evaluation_score', nullable: true })
  evaluationScore!: string | null;

  @Column({ type: 'text', name: 'evaluation_comment', nullable: true })
  evaluationComment!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => ClassSessionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_session_id' })
  classSession!: ClassSessionOrmEntity;

  @ManyToOne(() => StudentOrmEntity)
  @JoinColumn({ name: 'student_id' })
  student!: StudentOrmEntity;

  @ManyToOne(() => StudentMonthlyBillOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bill_id' })
  bill!: StudentMonthlyBillOrmEntity | null;
}
