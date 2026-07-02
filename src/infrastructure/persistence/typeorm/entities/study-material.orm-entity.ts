import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClassOrmEntity } from './class.orm-entity';
import { UserOrmEntity } from './user.orm-entity';

@Entity('study_materials')
export class StudyMaterialOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'class_id' })
  classId!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', name: 'file_name' })
  fileName!: string;

  @Column({ type: 'varchar', name: 'object_key', unique: true })
  objectKey!: string;

  @Column({ type: 'varchar', name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'bigint', name: 'file_size' })
  fileSize!: number;

  @Column({ type: 'uuid', name: 'uploaded_by_user_id' })
  uploadedByUserId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => ClassOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  classEntity!: ClassOrmEntity;

  @ManyToOne(() => UserOrmEntity)
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedByUser!: UserOrmEntity;
}
