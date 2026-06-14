import { Injectable } from '@nestjs/common';
import { PaymentQrCodePort } from '../../application/ports/payment-services.port';

@Injectable()
export class VietQrQrCodeAdapter extends PaymentQrCodePort {
  build(input: Parameters<PaymentQrCodePort['build']>[0]): string {
    const cleanAddInfo = input.transferContent
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .trim();
    const params = new URLSearchParams({
      amount: String(Math.round(input.amount)),
      addInfo: cleanAddInfo,
      accountName: input.bank.accountName,
    });
    return `https://img.vietqr.io/image/${input.bank.bankCode}-${input.bank.accountNumber}-compact2.png?${params.toString()}`;
  }
}
