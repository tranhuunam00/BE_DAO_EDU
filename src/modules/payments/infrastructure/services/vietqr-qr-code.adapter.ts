import { Injectable } from '@nestjs/common';
import { PaymentQrCodePort } from '../../application/ports/payment-services.port';

const binToShortName: Record<string, string> = {
  '970418': 'BIDV',
  '970405': 'Agribank',
  '970415': 'VietinBank',
  '970436': 'Vietcombank',
  '970422': 'MB',
  '970407': 'Techcombank',
  '970423': 'TPBank',
  '970432': 'VPBank',
  '970403': 'Sacombank',
  '970428': 'NamABank',
  '970454': 'VietABank',
  '970452': 'KienLongBank',
  '970441': 'VIB',
  '970443': 'SHB',
  '970429': 'SCB',
  '970440': 'SeABank',
  '970437': 'HDBank',
  '970416': 'ACB',
  '970457': 'WooriBank',
  '970434': 'IVB',
  '970412': 'PVcomBank',
  '970448': 'OCB',
  '970414': 'OceanBank',
  '970409': 'BacABank',
  '970419': 'NCB',
  '970426': 'MSB',
  '970430': 'PG先进Bank', // PG Bank
  '970449': 'LPBank',
  '970406': 'DongABank',
  '970433': 'VietCapitalBank',
  '970442': 'GPBank',
  '970421': 'VRB',
  '970458': 'UOB',
  '970439': 'ShinhanBank',
  '970431': 'Eximbank',
};

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
    const rawBankCode = input.bank.bankCode?.trim() || '';
    const bankCode = binToShortName[rawBankCode] || rawBankCode;
    return `https://img.vietqr.io/image/${bankCode}-${input.bank.accountNumber}-compact2.png?${params.toString()}`;
  }
}
