import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CourseLevelOrmEntity } from './course-level.orm-entity';

@Entity('course_level_pricing')
export class CourseLevelPricingOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'course_level_id' })
  courseLevelId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'price_per_session' })
  pricePerSession!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'teacher_wage_per_session', default: 0 })
  teacherWagePerSession!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'ta_wage_per_session', default: 0 })
  taWagePerSession!: number;

  @Column({ type: 'date', name: 'effective_from' })
  effectiveFrom!: string;

  @Column({ type: 'date', name: 'effective_to', nullable: true })
  effectiveTo!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => CourseLevelOrmEntity)
  @JoinColumn({ name: 'course_level_id' })
  courseLevel!: CourseLevelOrmEntity;
}
