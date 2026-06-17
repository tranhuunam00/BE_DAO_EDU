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
import { UserOrmEntity } from './user.orm-entity';

@Entity('lead_interactions')
@Index('IDX_lead_interactions_lead_id', ['leadId'])
@Index('IDX_lead_interactions_created_at', ['createdAt'])
export class LeadInteractionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'lead_id', type: 'uuid' })
  leadId!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ name: 'action_type', type: 'varchar', length: 50, default: 'NOTE' })
  actionType!: string;

  @Column({ name: 'status_from', type: 'varchar', length: 50, nullable: true })
  statusFrom!: string | null;

  @Column({ name: 'status_to', type: 'varchar', length: 50, nullable: true })
  statusTo!: string | null;

  @Column({ type: 'text', default: '' })
  notes!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => LeadOrmEntity, (lead) => lead.interactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead!: LeadOrmEntity;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor!: UserOrmEntity | null;
}
