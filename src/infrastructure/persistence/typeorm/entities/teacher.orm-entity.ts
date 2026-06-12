import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { UserOrmEntity } from './user.orm-entity';

@Entity('teachers')
export class TeacherOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @OneToOne(() => UserOrmEntity, { cascade: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  user!: UserOrmEntity;

  @Column({ type: 'varchar', name: 'employee_id', unique: true })
  employeeId!: string;

  @Column({ type: 'varchar' })
  subject!: string;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  gender!: string | null;

  @Column({ type: 'date', nullable: true })
  birthdate!: string | null;

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;
}
