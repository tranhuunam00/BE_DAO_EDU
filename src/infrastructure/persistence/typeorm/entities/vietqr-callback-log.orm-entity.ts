import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('vietqr_callback_logs')
export class VietQrCallbackLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'transaction_id', nullable: true })
  transactionId!: string | null;

  @Column({ type: 'varchar', name: 'reference_number', nullable: true })
  referenceNumber!: string | null;

  @Column({ type: 'varchar', name: 'order_id', nullable: true })
  orderId!: string | null;

  @Column({ type: 'uuid', name: 'payment_request_id', nullable: true })
  paymentRequestId!: string | null;

  @Column({ type: 'uuid', name: 'bill_id', nullable: true })
  billId!: string | null;

  @Column({ type: 'varchar' })
  result!: 'received' | 'success' | 'duplicate' | 'rejected';

  @Column({ type: 'varchar', name: 'error_reason', nullable: true })
  errorReason!: string | null;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamp with time zone', name: 'processed_at', nullable: true })
  processedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
