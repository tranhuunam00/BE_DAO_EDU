import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(
          'JWT_SECRET',
          'SUPER_SECRET_KEY_FOR_DEV_ONLY_12345',
        ),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
})
export class SecurityModule {}
