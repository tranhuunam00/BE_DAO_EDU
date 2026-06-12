import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ClassOrmEntity } from './class.orm-entity';
import { StudentOrmEntity } from './student.orm-entity';

@Entity('class_students')
export class ClassStudentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'class_id' })
  classId!: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Column({ type: 'varchar', default: 'Active' })
  status!: string;

  @Column({ type: 'date', name: 'joined_date' })
  joinedDate!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => ClassOrmEntity)
  @JoinColumn({ name: 'class_id' })
  classEntity!: ClassOrmEntity;

  @ManyToOne(() => StudentOrmEntity)
  @JoinColumn({ name: 'student_id' })
  student!: StudentOrmEntity;
}
