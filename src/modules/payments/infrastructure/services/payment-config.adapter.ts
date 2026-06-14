import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BankAccountConfig,
  PaymentConfigPort,
} from '../../application/ports/payment-services.port';

@Injectable()
export class PaymentConfigAdapter extends PaymentConfigPort {
  constructor(private readonly config: ConfigService) {
    super();
  }

  getBankAccount(): BankAccountConfig {
    const bankCode = this.config.get<string>('VIETQR_BANK_CODE')?.trim();
    const accountNumber = this.config
      .get<string>('VIETQR_ACCOUNT_NUMBER')
      ?.trim();
    const accountName = this.config.get<string>('VIETQR_ACCOUNT_NAME')?.trim();
    if (!bankCode || !accountNumber || !accountName) {
      throw new BadRequestException(
        'Chưa cấu hình VIETQR_BANK_CODE, VIETQR_ACCOUNT_NUMBER và VIETQR_ACCOUNT_NAME',
      );
    }
    if (!/^[A-Za-z0-9]{2,20}$/.test(bankCode)) {
      throw new BadRequestException('VIETQR_BANK_CODE không hợp lệ');
    }
    if (!/^\d{1,19}$/.test(accountNumber)) {
      throw new BadRequestException('VIETQR_ACCOUNT_NUMBER không hợp lệ');
    }
    if (accountName.length > 100) {
      throw new BadRequestException('VIETQR_ACCOUNT_NAME quá dài');
    }
    return { bankCode, accountNumber, accountName };
  }

  isDemoEnabled(): boolean {
    return this.config.get<string>('VIETQR_DEMO_ENABLED') === 'true';
  }
}
