import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { StudentMonthlyBillOrmEntity } from './student-monthly-bill.orm-entity';
import { TeacherMonthlyWageOrmEntity } from './teacher-monthly-wage.orm-entity';

@Entity('payment_periods')
export class PaymentPeriodOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  type!: 'tuition' | 'salary';

  @Column({ type: 'varchar' })
  month!: string;

  @Column({ type: 'timestamp', name: 'start_date' })
  startDate!: Date;

  @Column({ type: 'timestamp', name: 'end_date' })
  endDate!: Date;

  @Column({ type: 'varchar', default: 'Active' })
  status!: 'Active' | 'Closed';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => StudentMonthlyBillOrmEntity, (bill) => bill.period)
  studentBills!: StudentMonthlyBillOrmEntity[];

  @OneToMany(() => TeacherMonthlyWageOrmEntity, (wage) => wage.period)
  teacherWages!: TeacherMonthlyWageOrmEntity[];
}
