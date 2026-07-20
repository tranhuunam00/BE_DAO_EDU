import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PaymentError } from '../../../../src/modules/payments/domain/errors/payment.error';
import { VietQrCallbackController } from '../../../../src/presentation/controllers/vietqr-callback.controller';

describe('VietQrCallbackController', () => {
  const createController = () => {
    const generate = { execute: jest.fn() };
    const process = { execute: jest.fn() };
    const simulate = { execute: jest.fn() };
    const list = { execute: jest.fn() };
    return {
      controller: new VietQrCallbackController(
        generate as any,
        process as any,
        simulate as any,
        list as any,
      ),
      generate,
      process,
      simulate,
      list,
    };
  };

  it('delegates token generation and transaction processing', async () => {
    const { controller, generate, process } = createController();
    generate.execute.mockResolvedValue({ access_token: 'token' });
    process.execute.mockResolvedValue({ error: false });

    await expect(controller.token('Basic credentials')).resolves.toEqual({
      access_token: 'token',
    });
    await expect(
      controller.transactionSync('Bearer token', { amount: 1000 }),
    ).resolves.toEqual({ error: false });

    expect(generate.execute).toHaveBeenCalledWith('Basic credentials');
    expect(process.execute).toHaveBeenCalledWith('Bearer token', {
      amount: 1000,
    });
  });

  it('maps callback domain errors to VietQR-compatible HTTP errors', async () => {
    const { controller, process } = createController();
    process.execute.mockRejectedValue(
      new PaymentError('AMOUNT_MISMATCH', 'Số tiền không khớp'),
    );

    await expect(
      controller.transactionSync('Bearer token', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    process.execute.mockRejectedValue(
      new PaymentError('AUTHORIZATION_FAILED', 'Token không hợp lệ'),
    );
    await expect(
      controller.transactionSync('Bearer token', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('delegates demo terminal and audit listing', async () => {
    const { controller, simulate, list } = createController();
    simulate.execute.mockResolvedValue({ error: false });
    list.execute.mockResolvedValue([{ id: 'audit-1' }]);

    await controller.simulateTerminalSuccess(
      { user: { sub: 'student-user' } },
      'bill-1',
    );
    await expect(controller.findCallbackLogs('25')).resolves.toEqual([
      { id: 'audit-1' },
    ]);

    expect(simulate.execute).toHaveBeenCalledWith({
      billId: 'bill-1',
      studentUserId: 'student-user',
    });
    expect(list.execute).toHaveBeenCalledWith('25');
  });
});
