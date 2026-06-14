/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { VietQrCallbackController } from './vietqr-callback.controller';

describe('VietQrCallbackController', () => {
  const body = {
    bankaccount: '2152486504',
    amount: 1250000,
    transType: 'C' as const,
    content: 'DAOHP12345678ABCD',
    transactionid: 'vietqr-transaction-1',
    transactiontime: 1757342061000,
    referencenumber: 'reference-1',
    orderId: 'request-1',
  };

  const createController = () => {
    const audit = {
      id: 'audit-1',
      result: 'received',
      paymentRequestId: null,
      billId: null,
    };
    const paymentRequest = {
      id: 'request-1',
      billId: 'bill-1',
      amount: 1250000,
      accountNumber: '2152486504',
      transferContent: body.content,
      status: 'processing',
      reconciledAt: null,
    };
    const bill = {
      id: 'bill-1',
      status: 'Unpaid',
      paidAmount: 0,
      paymentDate: null,
      note: null,
    };
    const repos = {
      callbackLogRepo: {
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => {
          Object.assign(audit, value);
          return audit;
        }),
        findOneByOrFail: jest.fn(async () => audit),
        find: jest.fn(async () => [audit]),
      },
      paymentRequestRepo: {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn(async () => paymentRequest),
        })),
        save: jest.fn(async (value) => value),
      },
      billRepo: {
        findOne: jest.fn(async () => bill),
        save: jest.fn(async (value) => value),
      },
      paymentLogRepo: {
        findOne: jest.fn(async () => null),
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => ({ id: 'payment-log-1', ...value })),
      },
    };
    const manager = {
      getRepository: jest.fn((entity: { name: string }) => {
        if (entity.name === 'TuitionPaymentRequestOrmEntity') {
          return repos.paymentRequestRepo;
        }
        if (entity.name === 'StudentMonthlyBillOrmEntity') {
          return repos.billRepo;
        }
        if (entity.name === 'TuitionPaymentLogOrmEntity') {
          return repos.paymentLogRepo;
        }
        return repos.callbackLogRepo;
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    const configValues: Record<string, string> = {
      VIETQR_CALLBACK_USERNAME: 'vietqr-user',
      VIETQR_CALLBACK_PASSWORD: 'vietqr-password',
      VIETQR_CALLBACK_JWT_SECRET: 'callback-secret',
      VIETQR_DEMO_ENABLED: 'true',
    };
    const config = {
      get: jest.fn((key: string) => configValues[key]),
    };
    const jwtService = {
      signAsync: jest.fn(async () => 'callback-token'),
      verifyAsync: jest.fn(async () => ({
        sub: 'vietqr-user',
        purpose: 'vietqr_callback',
      })),
    };
    const controller = new VietQrCallbackController(
      config as any,
      jwtService as any,
      dataSource as any,
      repos.callbackLogRepo as any,
      {
        findOne: jest.fn(async () => ({
          ...paymentRequest,
          bill: { ...bill, student: { userId: 'student-user' } },
        })),
      } as any,
    );

    return {
      controller,
      repos,
      jwtService,
      paymentRequest,
      bill,
      audit,
    };
  };

  it('issues a short-lived callback token using Basic Auth', async () => {
    const { controller, jwtService } = createController();
    const credentials = Buffer.from('vietqr-user:vietqr-password').toString(
      'base64',
    );

    const result = await controller.generateToken(`Basic ${credentials}`);

    expect(result).toEqual({
      access_token: 'callback-token',
      token_type: 'Bearer',
      expires_in: 300,
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'vietqr_callback' }),
      expect.objectContaining({ expiresIn: 300, algorithm: 'HS512' }),
    );
  });

  it('runs the demo terminal through the real callback reconciliation path', async () => {
    const { controller, bill, audit } = createController();

    const result = await controller.simulateTerminalSuccess(
      { user: { sub: 'student-user', role: 'STUDENT' } },
      'bill-1',
    );

    expect(result.error).toBe(false);
    expect(bill.status).toBe('Paid');
    expect(audit.result).toBe('success');
  });

  it('reconciles only a valid credit callback and records both logs', async () => {
    const { controller, repos, paymentRequest, bill, audit } =
      createController();

    const result = await controller.transactionSync('Bearer callback-token', {
      ...body,
    });

    expect(result.error).toBe(false);
    expect(bill.status).toBe('Paid');
    expect(bill.paidAmount).toBe(body.amount);
    expect(paymentRequest.status).toBe('reconciled');
    expect(repos.paymentLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'vietqr_callback',
        externalTransactionId: body.transactionid,
      }),
    );
    expect(audit.result).toBe('success');
  });

  it('rejects an amount mismatch, keeps the bill unpaid and audits the reason', async () => {
    const { controller, repos, bill, audit } = createController();

    await expect(
      controller.transactionSync('Bearer callback-token', {
        ...body,
        amount: body.amount + 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repos.billRepo.save).not.toHaveBeenCalled();
    expect(bill.status).toBe('Unpaid');
    expect(audit.result).toBe('rejected');
    expect((audit as any).errorReason).toBe('AMOUNT_MISMATCH');
  });

  it('accepts a repeated transaction idempotently and audits it as duplicate', async () => {
    const { controller, repos, audit } = createController();
    repos.paymentLogRepo.findOne.mockResolvedValue({
      paymentRequestId: 'request-1',
      billId: 'bill-1',
    } as never);

    const result = await controller.transactionSync('Bearer callback-token', {
      ...body,
    });

    expect(result.error).toBe(false);
    expect(repos.billRepo.save).not.toHaveBeenCalled();
    expect(audit.result).toBe('duplicate');
  });

  it('rejects a new transaction for an already reconciled payment', async () => {
    const { controller, paymentRequest, repos, audit } = createController();
    paymentRequest.status = 'reconciled';

    await expect(
      controller.transactionSync('Bearer callback-token', { ...body }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repos.billRepo.save).not.toHaveBeenCalled();
    expect(audit.result).toBe('rejected');
    expect((audit as any).errorReason).toBe('PAYMENT_ALREADY_RECONCILED');
  });

  it('audits and rejects an invalid callback token', async () => {
    const { controller, jwtService, audit } = createController();
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid') as never);

    await expect(
      controller.transactionSync('Bearer invalid-token', { ...body }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(audit.result).toBe('rejected');
    expect((audit as any).errorReason).toBe('AUTHORIZATION_FAILED');
  });

  it('audits a malformed callback payload before returning 400', async () => {
    const { controller, audit } = createController();

    await expect(
      controller.transactionSync('Bearer callback-token', {
        ...body,
        amount: 0,
        transactionid: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(audit.result).toBe('rejected');
    expect((audit as any).errorReason).toBe('INVALID_REQUEST');
  });

  it('returns callback audit logs for the protected admin endpoint', async () => {
    const { controller, repos, audit } = createController();

    const result = await controller.findCallbackLogs('50');

    expect(result).toEqual([audit]);
    expect(repos.callbackLogRepo.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      take: 50,
    });
  });

  it('marks unexpected processing failures in the audit log', async () => {
    const { controller, audit } = createController();
    (controller as any).dataSource.transaction = jest
      .fn()
      .mockRejectedValue(new Error('database unavailable'));

    await expect(
      controller.transactionSync('Bearer callback-token', { ...body }),
    ).rejects.toThrow('database unavailable');

    expect(audit.result).toBe('rejected');
    expect((audit as any).errorReason).toBe('INTERNAL_PROCESSING_ERROR');
  });
});
