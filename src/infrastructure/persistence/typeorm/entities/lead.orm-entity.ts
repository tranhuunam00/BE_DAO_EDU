import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LeadDemandOrmEntity } from './lead-demand.orm-entity';
import { LeadInteractionOrmEntity } from './lead-interaction.orm-entity';

@Entity('leads')
@Index('IDX_leads_platform_profile_key', ['platform', 'profileKey'], { unique: true })
@Index('IDX_leads_contact_status', ['contactStatus'])
@Index('IDX_leads_created_at', ['createdAt'])
export class LeadOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, default: 'facebook' })
  platform!: string;

  @Column({ name: 'profile_key', type: 'varchar', length: 255 })
  profileKey!: string;

  @Column({ name: 'author_name', type: 'varchar', length: 255 })
  authorName!: string;

  @Column({ name: 'author_url', type: 'text' })
  authorUrl!: string;

  @Column({ name: 'contact_status', type: 'varchar', length: 50, default: 'NEW' })
  contactStatus!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => LeadDemandOrmEntity, (demand) => demand.lead)
  demands!: LeadDemandOrmEntity[];

  @OneToMany(() => LeadInteractionOrmEntity, (interaction) => interaction.lead)
  interactions!: LeadInteractionOrmEntity[];
}
