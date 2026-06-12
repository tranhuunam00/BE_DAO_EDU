import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ClassOrmEntity } from './class.orm-entity';
import { RoomOrmEntity } from './room.orm-entity';

@Entity('class_schedules')
export class ClassScheduleOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'class_id' })
  classId!: string;

  @Column({ type: 'uuid', name: 'room_id', nullable: true })
  roomId!: string | null;

  @Column({ type: 'varchar' })
  weekday!: string;

  @Column({ type: 'time', name: 'start_time' })
  startTime!: string;

  @Column({ type: 'time', name: 'end_time' })
  endTime!: string;

  @Column({ type: 'int', name: 'duration_mins', nullable: true })
  durationMins!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => ClassOrmEntity)
  @JoinColumn({ name: 'class_id' })
  classEntity!: ClassOrmEntity;

  @ManyToOne(() => RoomOrmEntity)
  @JoinColumn({ name: 'room_id' })
  room!: RoomOrmEntity;
}
