import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CourseOrmEntity } from './course.orm-entity';
import { CourseLevelOrmEntity } from './course-level.orm-entity';
import { TeacherOrmEntity } from './teacher.orm-entity';
import { CenterOrmEntity } from './center.orm-entity';

@Entity('classes')
export class ClassOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  @Column({ type: 'uuid', name: 'course_level_id' })
  courseLevelId!: string;

  @Column({ type: 'varchar', name: 'class_code', unique: true })
  classCode!: string;

  @Column({ type: 'varchar', name: 'class_name' })
  className!: string;

  @Column({ type: 'uuid', name: 'upgrade_from_class_id', nullable: true })
  upgradeFromClassId!: string | null;

  @Column({ type: 'varchar', name: 'type_of_class', nullable: true })
  typeOfClass!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'default_hours', nullable: true })
  defaultHours!: number | null;

  @Column({ type: 'varchar', default: 'Planning' })
  status!: string;

  @Column({ type: 'date', name: 'start_date', nullable: true })
  startDate!: string | null;

  @Column({ type: 'date', name: 'finish_date', nullable: true })
  finishDate!: string | null;

  @Column({ type: 'varchar', name: 'syllabus_by', nullable: true })
  syllabusBy!: string | null;

  @Column({ type: 'int', name: 'max_size', nullable: true })
  maxSize!: number | null;

  @Column({ type: 'boolean', name: 'skip_holidays', default: false })
  skipHolidays!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'uuid', name: 'main_teacher_id', nullable: true })
  mainTeacherId!: string | null;

  @Column({ type: 'uuid', name: 'assigned_to', nullable: true })
  assignedTo!: string | null;

  @Column({ type: 'varchar', name: 'cso_name', nullable: true })
  csoName!: string | null;

  @Column({ type: 'uuid', name: 'center_id', nullable: true })
  centerId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => CourseOrmEntity)
  @JoinColumn({ name: 'course_id' })
  course!: CourseOrmEntity;

  @ManyToOne(() => CourseLevelOrmEntity)
  @JoinColumn({ name: 'course_level_id' })
  courseLevel!: CourseLevelOrmEntity;

  @ManyToOne(() => TeacherOrmEntity)
  @JoinColumn({ name: 'main_teacher_id' })
  mainTeacher!: TeacherOrmEntity;

  @ManyToOne(() => CenterOrmEntity)
  @JoinColumn({ name: 'center_id' })
  center!: CenterOrmEntity;
}
