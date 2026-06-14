export interface BankAccountConfig {
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export abstract class PaymentConfigPort {
  abstract getBankAccount(): BankAccountConfig;
  abstract isDemoEnabled(): boolean;
}

export abstract class PaymentQrCodePort {
  abstract build(input: {
    bank: BankAccountConfig;
    amount: number;
    transferContent: string;
  }): string;
}

export abstract class VietQrTokenPort {
  abstract verifyBasicCredentials(authorization?: string): void;
  abstract issue(subject: string, expiresInSeconds: number): Promise<string>;
  abstract verifyBearer(authorization?: string): Promise<void>;
}

export abstract class PaymentIdPort {
  abstract transactionId(): string;
}
