import { VietQrTokenPort } from '../ports/payment-services.port';

export class GenerateVietQrTokenUseCase {
  constructor(private readonly tokens: VietQrTokenPort) {}

  async execute(authorization?: string) {
    this.tokens.verifyBasicCredentials(authorization);
    const expiresIn = 300;
    return {
      access_token: await this.tokens.issue('vietqr-callback', expiresIn),
      token_type: 'Bearer',
      expires_in: expiresIn,
    };
  }
}
