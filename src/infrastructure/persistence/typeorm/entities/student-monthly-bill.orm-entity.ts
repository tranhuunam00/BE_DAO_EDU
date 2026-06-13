import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { StudentOrmEntity } from './student.orm-entity';
import { PaymentPeriodOrmEntity } from './payment-period.orm-entity';

@Entity('student_monthly_bills')
export class StudentMonthlyBillOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Column({ type: 'uuid', name: 'period_id', nullable: true })
  periodId!: string | null;

  @Column({ type: 'varchar' })
  month!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount', default: 0 })
  totalAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'paid_amount', default: 0 })
  paidAmount!: number;

  @Column({ type: 'varchar', default: 'Unpaid' })
  status!: string;

  @Column({ type: 'timestamp', name: 'payment_date', nullable: true })
  paymentDate!: Date | null;

  @Column({ type: 'timestamp', name: 'billing_start_date', nullable: true })
  billingStartDate!: Date | null;

  @Column({ type: 'timestamp', name: 'billing_end_date', nullable: true })
  billingEndDate!: Date | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => StudentOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentOrmEntity;

  @ManyToOne(() => PaymentPeriodOrmEntity, (period) => period.studentBills, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'period_id' })
  period!: PaymentPeriodOrmEntity | null;
}
