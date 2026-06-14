import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentError } from '../../modules/payments/domain/errors/payment.error';
import { TuitionPaymentRequestController } from './tuition-payment-request.controller';

describe('TuitionPaymentRequestController', () => {
  const createController = () => {
    const send = { execute: jest.fn() };
    const claim = { execute: jest.fn() };
    const get = { execute: jest.fn() };
    return {
      controller: new TuitionPaymentRequestController(
        send as any,
        claim as any,
        get as any,
      ),
      send,
      claim,
      get,
    };
  };

  it('delegates sending a payment request to the application use case', async () => {
    const { controller, send } = createController();
    send.execute.mockResolvedValue({ id: 'request-1', status: 'pending' });

    await expect(controller.send('bill-1')).resolves.toEqual({
      id: 'request-1',
      status: 'pending',
    });
    expect(send.execute).toHaveBeenCalledWith('bill-1');
  });

  it('passes the authenticated student identity to the claim use case', async () => {
    const { controller, claim } = createController();
    claim.execute.mockResolvedValue({ status: 'processing' });

    await controller.confirmTransfer(
      { user: { sub: 'student-user' } },
      'bill-1',
    );

    expect(claim.execute).toHaveBeenCalledWith({
      billId: 'bill-1',
      studentUserId: 'student-user',
    });
  });

  it('maps domain errors to HTTP exceptions', async () => {
    const { controller, get, send } = createController();
    get.execute.mockRejectedValue(
      new PaymentError(
        'PAYMENT_REQUEST_NOT_FOUND',
        'Chưa có yêu cầu thanh toán',
      ),
    );
    await expect(
      controller.findForBill(
        { user: { sub: 'student-user', role: 'STUDENT' } },
        'bill-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    send.execute.mockRejectedValue(
      new PaymentError('BILL_ALREADY_PAID', 'Hóa đơn đã thanh toán'),
    );
    await expect(controller.send('bill-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
