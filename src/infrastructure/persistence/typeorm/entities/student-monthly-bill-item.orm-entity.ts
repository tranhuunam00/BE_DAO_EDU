import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { StudentMonthlyBillOrmEntity } from './student-monthly-bill.orm-entity';
import { ClassOrmEntity } from './class.orm-entity';

@Entity('student_monthly_bill_items')
export class StudentMonthlyBillItemOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'bill_id' })
  billId!: string;

  @Column({ type: 'uuid', name: 'class_id', nullable: true })
  classId!: string | null;

  @Column({ type: 'varchar', name: 'class_name' })
  className!: string;

  @Column({ type: 'varchar', name: 'course_name' })
  courseName!: string;

  @Column({ type: 'varchar', name: 'level_name' })
  levelName!: string;

  @Column({ type: 'integer', name: 'sessions_count', default: 0 })
  sessionsCount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  rate!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount', default: 0 })
  totalAmount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => StudentMonthlyBillOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bill_id' })
  bill!: StudentMonthlyBillOrmEntity;

  @ManyToOne(() => ClassOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'class_id' })
  class!: ClassOrmEntity | null;
}
