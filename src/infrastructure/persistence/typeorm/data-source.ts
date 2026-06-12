import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load variables from .env file
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

import { UserOrmEntity } from './entities/user.orm-entity';
import { StudentOrmEntity } from './entities/student.orm-entity';
import { TeacherOrmEntity } from './entities/teacher.orm-entity';
import { RoleOrmEntity } from './entities/role.orm-entity';
import { PermissionOrmEntity } from './entities/permission.orm-entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5435', 10),
  username: process.env.DATABASE_USER || 'dao_edu_db_admin',
  password: process.env.DATABASE_PASSWORD || 'P@ssw0rd_Edu_Dao_2026_Secure!',
  database: process.env.DATABASE_NAME || 'dao_edu_db',
  entities: [
    UserOrmEntity,
    StudentOrmEntity,
    TeacherOrmEntity,
    RoleOrmEntity,
    PermissionOrmEntity,
  ],
  migrations: [
    path.join(__dirname, '/migrations/*.{ts,js}')
  ],
  synchronize: false, // Turn off synchronize when using migrations
});
