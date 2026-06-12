import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CenterOrmEntity } from './center.orm-entity';

@Entity('rooms')
export class RoomOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'center_id' })
  centerId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'int', default: 30 })
  capacity!: number;

  @Column({ type: 'varchar', default: 'Active' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => CenterOrmEntity)
  @JoinColumn({ name: 'center_id' })
  center!: CenterOrmEntity;
}
