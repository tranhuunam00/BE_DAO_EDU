import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserOrmEntity } from './user.orm-entity';

@Entity('students')
export class StudentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'student_id', unique: true })
  studentId!: string;

  @Column({ type: 'varchar', name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar', name: 'nick_name', nullable: true })
  nickName!: string | null;

  @Column({ type: 'varchar' })
  gender!: string;

  @Column({ type: 'varchar' })
  mobile!: string;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ type: 'date' })
  birthdate!: string;

  @Column({ type: 'varchar', name: 'parent_guardian_1', nullable: true })
  parentGuardian1!: string | null;

  @Column({ type: 'varchar', name: 'parent_guardian_2', nullable: true })
  parentGuardian2!: string | null;

  @Column({ type: 'varchar', name: 'parent_1_citizen_id', nullable: true })
  parent1CitizenId!: string | null;

  @Column({ type: 'varchar', name: 'parent_2_citizen_id', nullable: true })
  parent2CitizenId!: string | null;

  @Column({ type: 'varchar', name: 'student_citizen_id', nullable: true })
  studentCitizenId!: string | null;

  @Column({ type: 'varchar', name: 'relationship_1', nullable: true })
  relationship1!: string | null;

  @Column({ type: 'varchar', name: 'relationship_2', nullable: true })
  relationship2!: string | null;

  @Column({ type: 'varchar', name: 'other_phone_1', nullable: true })
  otherPhone1!: string | null;

  @Column({ type: 'varchar', name: 'other_phone_2', nullable: true })
  otherPhone2!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', nullable: true })
  province!: string | null;

  @Column({ type: 'varchar', name: 'district_ward', nullable: true })
  districtWard!: string | null;

  @Column({ type: 'varchar', name: 'primary_address' })
  primaryAddress!: string;

  @Column({ type: 'varchar', name: 'old_address', nullable: true })
  oldAddress!: string | null;

  @Column({ type: 'varchar', default: 'Waiting for class' })
  status!: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  @OneToOne(() => UserOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: UserOrmEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
