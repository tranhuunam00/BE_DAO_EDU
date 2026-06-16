import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FacebookLeadScanOrmEntity } from './facebook-lead-scan.orm-entity';

@Entity('facebook_lead_items')
@Index('UQ_facebook_lead_items_fingerprint', ['fingerprint'], { unique: true })
@Index('IDX_facebook_lead_items_scan_id', ['scanId'])
@Index('IDX_facebook_lead_items_post_id', ['postId'])
export class FacebookLeadItemOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'scan_id', type: 'uuid' })
  scanId!: string;

  @ManyToOne(() => FacebookLeadScanOrmEntity, (scan) => scan.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'scan_id' })
  scan!: FacebookLeadScanOrmEntity;

  @Column({ name: 'fingerprint', type: 'varchar', length: 120 })
  fingerprint!: string;

  @Column({ name: 'parser_version', type: 'int', nullable: true })
  parserVersion!: number | null;

  @Column({ type: 'varchar', length: 20 })
  kind!: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  source!: string;

  @Column({ name: 'group_url', type: 'text', default: '' })
  groupUrl!: string;

  @Column({ name: 'page_url', type: 'text', default: '' })
  pageUrl!: string;

  @Column({ name: 'source_url', type: 'text', default: '' })
  sourceUrl!: string;

  @Column({
    name: 'parent_fingerprint',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  parentFingerprint!: string | null;

  @Column({ name: 'post_id', type: 'varchar', length: 80, default: '' })
  postId!: string;

  @Column({ name: 'comment_id', type: 'varchar', length: 120, nullable: true })
  commentId!: string | null;

  @Column({
    name: 'parent_comment_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  parentCommentId!: string | null;

  @Column({ name: 'depth', type: 'int', default: 0 })
  depth!: number;

  @Column({ name: 'tree_path', type: 'text', default: '' })
  treePath!: string;

  @Column({
    name: 'context_texts',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  contextTexts!: string[];

  @Column({ name: 'reply_to_author', type: 'varchar', length: 160, default: '' })
  replyToAuthor!: string;

  @Column({ name: 'author_name', type: 'varchar', length: 160, default: '' })
  authorName!: string;

  @Column({ name: 'author_url', type: 'text', default: '' })
  authorUrl!: string;

  @Column({ name: 'text', type: 'text', default: '' })
  text!: string;

  @Column({ name: 'captured_at', type: 'timestamptz', nullable: true })
  capturedAt!: Date | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ name: 'raw', type: 'jsonb', default: () => "'{}'::jsonb" })
  raw!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
