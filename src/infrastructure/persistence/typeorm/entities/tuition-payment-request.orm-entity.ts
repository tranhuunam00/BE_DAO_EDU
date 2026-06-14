import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StudentMonthlyBillOrmEntity } from './student-monthly-bill.orm-entity';

@Entity('tuition_payment_requests')
export class TuitionPaymentRequestOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'bill_id', unique: true })
  billId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', name: 'bank_code' })
  bankCode!: string;

  @Column({ type: 'varchar', name: 'account_number' })
  accountNumber!: string;

  @Column({ type: 'varchar', name: 'account_name' })
  accountName!: string;

  @Column({ type: 'varchar', name: 'transfer_content', unique: true })
  transferContent!: string;

  @Column({ type: 'text', name: 'qr_url' })
  qrUrl!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: 'pending' | 'cancelled';

  @Column({ type: 'timestamp with time zone', name: 'sent_at' })
  sentAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => StudentMonthlyBillOrmEntity, (bill) => bill.paymentRequest, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bill_id' })
  bill!: StudentMonthlyBillOrmEntity;
}
