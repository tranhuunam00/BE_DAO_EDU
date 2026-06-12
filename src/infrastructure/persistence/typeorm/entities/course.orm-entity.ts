import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('courses')
export class CourseOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  category!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', name: 'short_name' })
  shortName!: string;

  @Column({ type: 'varchar', name: 'type_of_period', nullable: true })
  typeOfPeriod!: string | null;

  @Column({ type: 'varchar', nullable: true })
  year!: string | null;

  @Column({ type: 'int', name: 'max_size', nullable: true })
  maxSize!: number | null;

  @Column({ type: 'varchar', default: 'Active' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'uuid', name: 'assigned_to', nullable: true })
  assignedTo!: string | null;

  @Column({ type: 'uuid', name: 'center_id', nullable: true })
  centerId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
