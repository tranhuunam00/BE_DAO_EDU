import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ClassSessionOrmEntity } from './class-session.orm-entity';
import { StudentOrmEntity } from './student.orm-entity';

@Entity('student_attendance')
export class StudentAttendanceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'class_session_id' })
  classSessionId!: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Column({ type: 'boolean', name: 'is_present', default: false })
  isPresent!: boolean;

  @Column({ type: 'varchar', nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => ClassSessionOrmEntity)
  @JoinColumn({ name: 'class_session_id' })
  classSession!: ClassSessionOrmEntity;

  @ManyToOne(() => StudentOrmEntity)
  @JoinColumn({ name: 'student_id' })
  student!: StudentOrmEntity;
}
