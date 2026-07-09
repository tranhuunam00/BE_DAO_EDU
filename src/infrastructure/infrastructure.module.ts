import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './persistence/typeorm/database.module';
import { SecurityModule } from './security/security.module';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmExceptionFilter } from './persistence/typeorm/typeorm-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
    }),
    DatabaseModule,
    SecurityModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: TypeOrmExceptionFilter,
    },
  ],
})
export class InfrastructureModule {}
