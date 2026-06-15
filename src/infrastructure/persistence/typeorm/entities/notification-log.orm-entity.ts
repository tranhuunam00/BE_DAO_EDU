import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserOrmEntity } from './user.orm-entity';

@Entity('notification_logs')
export class NotificationLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'notification_id', nullable: true })
  notificationId!: string | null;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string | null;

  @Column({ type: 'varchar', name: 'event_type' })
  eventType!: string;

  @Column({ type: 'varchar', name: 'notification_type' })
  notificationType!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: UserOrmEntity | null;
}
