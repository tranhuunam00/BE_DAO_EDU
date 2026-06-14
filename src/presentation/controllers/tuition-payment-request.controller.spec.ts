/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '../../domain/value-objects/role.enum';
import { TuitionPaymentRequestController } from './tuition-payment-request.controller';

describe('TuitionPaymentRequestController', () => {
  const createController = (configValues: Record<string, string> = {}) => {
    const repos = {
      paymentRequestRepo: {
        findOne: jest.fn(),
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => ({ id: 'request-1', ...value })),
      },
      billRepo: { findOne: jest.fn() },
      notificationRepo: {
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => value),
      },
    };
    const config = {
      get: jest.fn((key: string) => configValues[key]),
    };
    const controller = new TuitionPaymentRequestController(
      repos.paymentRequestRepo as any,
      repos.billRepo as any,
      repos.notificationRepo as any,
      config as any,
    );
    return { controller, repos };
  };

  const bill = {
    id: '12345678-abcd-4000-8000-123456789abc',
    month: '2026-06',
    totalAmount: 1250000,
    status: 'Unpaid',
    student: { userId: 'student-user' },
    period: { name: 'Học phí tháng 6' },
  };
  const bankConfig = {
    VIETQR_BANK_CODE: 'MB',
    VIETQR_ACCOUNT_NUMBER: '123456789',
    VIETQR_ACCOUNT_NAME: 'DAO EDUCATION',
  };

  it('creates a pending QR request and notifies the student without marking the bill paid', async () => {
    const { controller, repos } = createController(bankConfig);
    repos.billRepo.findOne.mockResolvedValue({ ...bill });
    repos.paymentRequestRepo.findOne.mockResolvedValue(null);

    const result = await controller.send(bill.id);

    expect(result.status).toBe('pending');
    expect(result.transferContent).toBe('DAOHP12345678ABCD');
    expect(result.qrUrl).toContain('MB-123456789-compact2.png');
    expect(result.qrUrl).toContain('amount=1250000');
    expect(repos.billRepo).not.toHaveProperty('save');
    expect(repos.notificationRepo.save).toHaveBeenCalledTimes(1);
  });

  it('updates the existing request when admin sends it again', async () => {
    const { controller, repos } = createController(bankConfig);
    repos.billRepo.findOne.mockResolvedValue({ ...bill, totalAmount: 1500000 });
    repos.paymentRequestRepo.findOne.mockResolvedValue({
      id: 'request-1',
      billId: bill.id,
      status: 'cancelled',
    });

    const result = await controller.send(bill.id);

    expect(result.id).toBe('request-1');
    expect(result.amount).toBe(1500000);
    expect(result.status).toBe('pending');
  });

  it('rejects QR creation for a paid or zero-value bill', async () => {
    const { controller, repos } = createController(bankConfig);
    repos.billRepo.findOne.mockResolvedValue({ ...bill, status: 'Paid' });
    await expect(controller.send(bill.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    repos.billRepo.findOne.mockResolvedValue({
      ...bill,
      totalAmount: 0,
    });
    await expect(controller.send(bill.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects sending when student has no login account or bank is not configured', async () => {
    const { controller, repos } = createController(bankConfig);
    repos.billRepo.findOne.mockResolvedValue({
      ...bill,
      student: { userId: null },
    });
    await expect(controller.send(bill.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const missingConfig = createController();
    missingConfig.repos.billRepo.findOne.mockResolvedValue({ ...bill });
    await expect(missingConfig.controller.send(bill.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('hides another student payment request', async () => {
    const { controller, repos } = createController(bankConfig);
    repos.paymentRequestRepo.findOne.mockResolvedValue({
      bill: { student: { userId: 'another-user' } },
    });

    await expect(
      controller.findForBill(
        { user: { sub: 'student-user', role: Role.STUDENT } },
        bill.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
