import { readFileSync } from 'fs';
import { join } from 'path';

describe('Billing architecture boundaries', () => {
  it.each([
    'domain/entities/payment-period.ts',
    'domain/entities/billing-order.ts',
    'domain/services/billing-calculator.ts',
    'domain/value-objects/billing-period.ts',
    'application/use-cases/create-payment-period.use-case.ts',
    'application/use-cases/preview-billing.use-case.ts',
    'application/use-cases/manage-payment-period.use-cases.ts',
  ])('%s does not depend on framework or infrastructure', (relativePath) => {
    const content = readFileSync(join(__dirname, relativePath), 'utf8');
    expect(content).not.toMatch(/@nestjs|typeorm|infrastructure\//);
  });
});
