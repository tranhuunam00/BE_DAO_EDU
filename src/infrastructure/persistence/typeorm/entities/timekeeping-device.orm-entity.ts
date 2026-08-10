import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('timekeeping_device')
export class TimekeepingDeviceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50, name: 'ip_address' })
  ipAddress!: string;

  @Column({ type: 'int', default: 80 })
  port!: number;

  @Column({ type: 'varchar', length: 50, default: 'admin' })
  username!: string;

  @Column({ type: 'varchar', length: 100 })
  password!: string;

  @Column({ type: 'varchar', length: 20, default: 'offline' })
  status!: string; // 'online' | 'offline'

  @Column({ type: 'timestamp', nullable: true, name: 'last_sync_time' })
  lastSyncTime!: Date | null;
}
