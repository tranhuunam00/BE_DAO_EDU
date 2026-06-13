import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { TeacherOrmEntity } from './teacher.orm-entity';
import { PaymentPeriodOrmEntity } from './payment-period.orm-entity';
import { TeacherMonthlyWageItemOrmEntity } from './teacher-monthly-wage-item.orm-entity';

@Entity('teacher_monthly_wages')
export class TeacherMonthlyWageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'teacher_id' })
  teacherId!: string;

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

  @ManyToOne(() => TeacherOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher!: TeacherOrmEntity;

  @ManyToOne(() => PaymentPeriodOrmEntity, (period) => period.teacherWages, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'period_id' })
  period!: PaymentPeriodOrmEntity | null;

  @OneToMany(() => TeacherMonthlyWageItemOrmEntity, (item) => item.wage)
  items!: TeacherMonthlyWageItemOrmEntity[];
}
