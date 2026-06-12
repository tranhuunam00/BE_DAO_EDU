import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CourseOrmEntity } from './course.orm-entity';

@Entity('course_levels')
export class CourseLevelOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  @Column({ type: 'varchar', name: 'level_name' })
  levelName!: string;

  @Column({ type: 'varchar', name: 'level_code' })
  levelCode!: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'total_hours' })
  totalHours!: number;

  @Column({ type: 'boolean', name: 'is_fixed_hour', default: false })
  isFixedHour!: boolean;

  @Column({ type: 'boolean', name: 'can_upgrade', default: false })
  canUpgrade!: boolean;

  @Column({ type: 'text', name: 'gradebook_setting', nullable: true })
  gradebookSetting!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => CourseOrmEntity)
  @JoinColumn({ name: 'course_id' })
  course!: CourseOrmEntity;
}
