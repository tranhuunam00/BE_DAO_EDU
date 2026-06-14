import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TYPEORM_ENTITIES } from './typeorm.entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5435),
        username: config.get<string>('DATABASE_USER', 'dao_edu_db_admin'),
        password: config.get<string>(
          'DATABASE_PASSWORD',
          'P@ssw0rd_Edu_Dao_2026_Secure!',
        ),
        database: config.get<string>('DATABASE_NAME', 'dao_edu_db'),
        entities: TYPEORM_ENTITIES,
        synchronize: false,
        migrationsRun: true,
        migrations: [__dirname + '/migrations/*.{js,ts}'],
      }),
    }),
  ],
})
export class DatabaseModule {}
