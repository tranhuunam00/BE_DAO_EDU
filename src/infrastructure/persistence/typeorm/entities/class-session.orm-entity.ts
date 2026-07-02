import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ClassOrmEntity } from './class.orm-entity';
import { RoomOrmEntity } from './room.orm-entity';
import { TeacherOrmEntity } from './teacher.orm-entity';
import { TeacherMonthlyWageOrmEntity } from './teacher-monthly-wage.orm-entity';

@Entity('class_sessions')
export class ClassSessionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'class_id' })
  classId!: string;

  @Column({ type: 'uuid', name: 'room_id', nullable: true })
  roomId!: string | null;

  @Column({ type: 'uuid', name: 'teacher_id', nullable: true })
  teacherId!: string | null;

  @Column({ type: 'uuid', name: 'assistant_id', nullable: true })
  assistantId!: string | null;

  @Column({ type: 'uuid', name: 'wage_id', nullable: true })
  wageId!: string | null;

  @Column({ type: 'uuid', name: 'assistant_wage_id', nullable: true })
  assistantWageId!: string | null;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'time', name: 'start_time' })
  startTime!: string;

  @Column({ type: 'time', name: 'end_time' })
  endTime!: string;

  @Column({ type: 'varchar', default: 'Scheduled' })
  status!: string;

  @Column({ type: 'boolean', name: 'attendance_locked', default: false })
  attendanceLocked!: boolean;

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

  @ManyToOne(() => TeacherOrmEntity)
  @JoinColumn({ name: 'teacher_id' })
  teacher!: TeacherOrmEntity;

  @ManyToOne(() => TeacherOrmEntity, { nullable: true })
  @JoinColumn({ name: 'assistant_id' })
  assistant!: TeacherOrmEntity | null;

  @ManyToOne(() => TeacherMonthlyWageOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'wage_id' })
  wage!: TeacherMonthlyWageOrmEntity | null;

  @ManyToOne(() => TeacherMonthlyWageOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assistant_wage_id' })
  assistantWage!: TeacherMonthlyWageOrmEntity | null;
}
