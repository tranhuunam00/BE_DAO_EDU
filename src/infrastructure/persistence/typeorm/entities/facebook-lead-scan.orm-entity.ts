import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FacebookLeadItemOrmEntity } from './facebook-lead-item.orm-entity';

@Entity('facebook_lead_scans')
@Index('IDX_facebook_lead_scans_created_at', ['createdAt'])
@Index('UQ_facebook_lead_scans_session', ['scanSessionId'], { unique: true })
export class FacebookLeadScanOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'scan_session_id', type: 'varchar', length: 120 })
  scanSessionId!: string;

  @Column({ type: 'varchar', length: 80 })
  source!: string;

  @Column({ name: 'group_url', type: 'text', default: '' })
  groupUrl!: string;

  @Column({ name: 'post_url', type: 'text', default: '' })
  postUrl!: string;

  @Column({ name: 'post_id', type: 'varchar', length: 80, default: '' })
  postId!: string;

  @Column({ name: 'scanned_at', type: 'timestamptz', nullable: true })
  scannedAt!: Date | null;

  @Column({ name: 'exported_at', type: 'timestamptz', nullable: true })
  exportedAt!: Date | null;

  @Column({ name: 'item_count', type: 'int', default: 0 })
  itemCount!: number;

  @Column({ name: 'accepted_items', type: 'int', default: 0 })
  acceptedItems!: number;

  @Column({ name: 'duplicate_items', type: 'int', default: 0 })
  duplicateItems!: number;

  @Column({ name: 'meta', type: 'jsonb', nullable: true })
  meta!: Record<string, unknown> | null;

  @Column({ name: 'local_analysis', type: 'jsonb', nullable: true })
  localAnalysis!: Record<string, unknown> | null;

  @Column({ name: 'detection', type: 'jsonb', default: () => "'{}'::jsonb" })
  detection!: Record<string, unknown>;

  @Column({ name: 'ai_analysis_status', type: 'varchar', length: 30, default: 'PENDING' })
  aiAnalysisStatus!: string;

  @Column({ name: 'ai_analysis_retry_count', type: 'int', default: 0 })
  aiAnalysisRetryCount!: number;

  @Column({ name: 'ai_analysis_error', type: 'text', nullable: true })
  aiAnalysisError!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => FacebookLeadItemOrmEntity, (item) => item.scan)
  items!: FacebookLeadItemOrmEntity[];
}
