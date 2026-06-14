import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClassOrmEntity } from './class.orm-entity';
import { TeacherOrmEntity } from './teacher.orm-entity';

@Entity('assignments')
export class AssignmentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'class_id' })
  classId!: string;

  @Column({ type: 'uuid', name: 'created_by_teacher_id', nullable: true })
  createdByTeacherId!: string | null;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'timestamp with time zone', name: 'due_at', nullable: true })
  dueAt!: Date | null;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    name: 'max_score',
    default: 10,
  })
  maxScore!: number;

  @Column({ type: 'varchar', default: 'draft' })
  status!: 'draft' | 'published' | 'closed';

  @Column({
    type: 'timestamp with time zone',
    name: 'published_at',
    nullable: true,
  })
  publishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => ClassOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  classEntity!: ClassOrmEntity;

  @ManyToOne(() => TeacherOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_teacher_id' })
  createdByTeacher!: TeacherOrmEntity | null;
}
