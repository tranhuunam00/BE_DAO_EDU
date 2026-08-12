import { Entity, PrimaryGeneratedColumn, Column, Unique, Index, ManyToOne, JoinColumn } from 'typeorm';
import { StudentOrmEntity } from './student.orm-entity';

@Entity('timekeeping_log')
@Unique(['employeeNo', 'eventTime'])
export class TimekeepingLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_timekeeping_log_student_id')
  @Column({ type: 'uuid', name: 'student_id', nullable: true })
  studentId!: string | null;

  @Column({ type: 'varchar', length: 50, name: 'employee_no' })
  employeeNo!: string;

  @Column({ type: 'timestamp', name: 'event_time' })
  eventTime!: Date;

  @Column({ type: 'varchar', length: 50, name: 'verify_method' })
  verifyMethod!: string; // 'face' | 'fingerprint' | 'card' | 'pin'

  @Column({ type: 'jsonb', nullable: true, name: 'raw_payload' })
  rawPayload!: any;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'original_id' })
  originalId!: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'matched_sessions' })
  matchedSessions!: Array<{ id: string; className: string; startTime: string; endTime: string; date: string }> | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'image_key' })
  imageKey!: string | null;


  @ManyToOne(() => StudentOrmEntity, { nullable: true })
  @JoinColumn({ name: 'student_id' })
  student!: StudentOrmEntity | null;
}
