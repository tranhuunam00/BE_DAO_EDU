import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { VietQrTokenPort } from '../../application/ports/payment-services.port';

@Injectable()
export class VietQrTokenAdapter extends VietQrTokenPort {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    super();
  }

  verifyBasicCredentials(authorization?: string): void {
    if (!authorization?.startsWith('Basic ')) {
      throw new UnauthorizedException('Basic Authorization header is required');
    }
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString(
      'utf8',
    );
    const separator = decoded.indexOf(':');
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    if (
      separator < 1 ||
      username !== this.required('VIETQR_CALLBACK_USERNAME') ||
      password !== this.required('VIETQR_CALLBACK_PASSWORD')
    ) {
      throw new UnauthorizedException('Invalid VietQR callback credentials');
    }
  }

  issue(subject: string, expiresInSeconds: number): Promise<string> {
    return this.jwt.signAsync(
      { sub: subject, purpose: 'vietqr_callback' },
      {
        secret: this.required('VIETQR_CALLBACK_JWT_SECRET'),
        expiresIn: expiresInSeconds,
        algorithm: 'HS512',
      },
    );
  }

  async verifyBearer(authorization?: string): Promise<void> {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token is required');
    }
    try {
      const payload = await this.jwt.verifyAsync<{ purpose?: string }>(token, {
        secret: this.required('VIETQR_CALLBACK_JWT_SECRET'),
        algorithms: ['HS512'],
      });
      if (payload.purpose !== 'vietqr_callback') throw new Error();
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired VietQR callback token',
      );
    }
  }

  private required(key: string) {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new Error(`Missing configuration: ${key}`);
    return value;
  }
}
