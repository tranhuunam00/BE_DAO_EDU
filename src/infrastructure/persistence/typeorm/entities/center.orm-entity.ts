import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('centers')
export class CenterOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'center_id', unique: true })
  centerId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  province!: string | null;

  @Column({ type: 'varchar', name: 'district_ward', nullable: true })
  districtWard!: string | null;

  @Column({ type: 'varchar', name: 'primary_address', nullable: true })
  primaryAddress!: string | null;

  @Column({ type: 'varchar', name: 'manager_name', nullable: true })
  managerName!: string | null;

  @Column({ type: 'varchar', default: 'Active' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
