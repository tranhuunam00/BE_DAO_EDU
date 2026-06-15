import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  ContactRequestStatus,
  ContactRequestType,
} from '../../../../modules/contact-requests/domain/entities/contact-request';

@Entity('contact_requests')
@Index('IDX_contact_requests_status_created_at', ['status', 'createdAt'])
export class ContactRequestOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: ContactRequestType;

  @Column({ type: 'varchar', length: 20, default: 'NEW' })
  status!: ContactRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
