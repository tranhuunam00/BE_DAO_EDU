import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentMonthlyBillOrmEntity } from './student-monthly-bill.orm-entity';
import { TuitionPaymentRequestOrmEntity } from './tuition-payment-request.orm-entity';

@Entity('tuition_payment_logs')
export class TuitionPaymentLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'payment_request_id' })
  paymentRequestId!: string;

  @Column({ type: 'uuid', name: 'bill_id' })
  billId!: string;

  @Column({ type: 'varchar' })
  event!: 'transfer_claimed' | 'auto_reconciled';

  @Column({ type: 'varchar' })
  status!: 'processing' | 'success' | 'failed';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', default: 'simulation' })
  source!: 'simulation' | 'vietqr_callback';

  @Column({
    type: 'varchar',
    name: 'external_transaction_id',
    nullable: true,
    unique: true,
  })
  externalTransactionId!: string | null;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => TuitionPaymentRequestOrmEntity, (request) => request.logs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_request_id' })
  paymentRequest!: TuitionPaymentRequestOrmEntity;

  @ManyToOne(() => StudentMonthlyBillOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bill_id' })
  bill!: StudentMonthlyBillOrmEntity;
}
