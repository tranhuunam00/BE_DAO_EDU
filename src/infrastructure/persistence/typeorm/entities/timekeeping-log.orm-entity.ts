import { Entity, PrimaryGeneratedColumn, Column, Unique, Index, ManyToOne, JoinColumn } from 'typeorm';
import { StudentOrmEntity } from './student.orm-entity';

@Entity('timekeeping_log')
@Unique(['studentId', 'eventTime'])
export class TimekeepingLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_timekeeping_log_student_id')
  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Column({ type: 'varchar', length: 50, name: 'employee_no' })
  employeeNo!: string;

  @Column({ type: 'timestamp', name: 'event_time' })
  eventTime!: Date;

  @Column({ type: 'varchar', length: 50, name: 'verify_method' })
  verifyMethod!: string; // 'face' | 'fingerprint' | 'card' | 'pin'

  @Column({ type: 'jsonb', nullable: true, name: 'raw_payload' })
  rawPayload!: any;

  @ManyToOne(() => StudentOrmEntity)
  @JoinColumn({ name: 'student_id' })
  student!: StudentOrmEntity;
}
