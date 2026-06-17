import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LeadOrmEntity } from './lead.orm-entity';
import { FacebookLeadScanOrmEntity } from './facebook-lead-scan.orm-entity';

@Entity('lead_demands')
@Index('IDX_lead_demands_lead_id', ['leadId'])
@Index('IDX_lead_demands_created_at', ['createdAt'])
export class LeadDemandOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'lead_id', type: 'uuid' })
  leadId!: string;

  @Column({ type: 'varchar', length: 50 })
  platform!: string;

  @Column({ name: 'scan_id', type: 'uuid', nullable: true })
  scanId!: string | null;

  @Column({ name: 'post_id', type: 'varchar', length: 255 })
  postId!: string;

  @Column({ name: 'post_url', type: 'text' })
  postUrl!: string;

  @Column({ type: 'varchar', length: 100 })
  classification!: string;

  @Column({ name: 'lead_score', type: 'int' })
  leadScore!: number;

  @Column({ name: 'lead_level', type: 'varchar', length: 50 })
  leadLevel!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  reasons!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  evidence!: Record<string, unknown>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => LeadOrmEntity, (lead) => lead.demands, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead!: LeadOrmEntity;

  @ManyToOne(() => FacebookLeadScanOrmEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'scan_id' })
  scan!: FacebookLeadScanOrmEntity | null;
}
