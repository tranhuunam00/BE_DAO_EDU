import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContactRequestController } from '../../../../src/presentation/controllers/contact-request.controller';

describe('ContactRequestController', () => {
  let controller: ContactRequestController;
  let submitContactRequest: { execute: jest.Mock };
  let listContactRequests: { execute: jest.Mock };
  let updateContactRequestStatus: { execute: jest.Mock };

  beforeEach(() => {
    submitContactRequest = { execute: jest.fn() };
    listContactRequests = { execute: jest.fn() };
    updateContactRequestStatus = { execute: jest.fn() };

    controller = new ContactRequestController(
      submitContactRequest as any,
      listContactRequests as any,
      updateContactRequestStatus as any,
    );
  });

  it('submits contact request successfully', async () => {
    const dto = { name: 'Nguyen Van A', phone: '0912345678', note: 'Can tu van' };
    submitContactRequest.execute.mockResolvedValue({ id: 'contact-1' });

    const result = await controller.submit(dto as any);
    expect(submitContactRequest.execute).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'contact-1', message: 'Đã gửi thông tin liên hệ thành công.' });
  });

  it('throws BadRequestException when submit contact request fails with invalid input message', async () => {
    submitContactRequest.execute.mockRejectedValue(new Error('CONTACT_REQUEST_INVALID_PHONE'));

    await expect(controller.submit({ name: 'A', phone: '123' } as any)).rejects.toThrow(BadRequestException);
  });

  it('lists contact requests for admin', async () => {
    const query = { status: 'PENDING' };
    listContactRequests.execute.mockResolvedValue([{ id: 'contact-1' }]);

    const result = await controller.list(query as any);
    expect(listContactRequests.execute).toHaveBeenCalledWith(query);
    expect(result).toEqual([{ id: 'contact-1' }]);
  });

  it('updates contact request status', async () => {
    updateContactRequestStatus.execute.mockResolvedValue({ id: 'contact-1', status: 'PROCESSED' });

    const result = await controller.updateStatus('contact-1', { status: 'PROCESSED' } as any);
    expect(updateContactRequestStatus.execute).toHaveBeenCalledWith('contact-1', 'PROCESSED');
    expect(result).toEqual({ id: 'contact-1', status: 'PROCESSED' });
  });

  it('throws NotFoundException when updating non-existent contact request status', async () => {
    updateContactRequestStatus.execute.mockRejectedValue(new Error('CONTACT_REQUEST_NOT_FOUND'));

    await expect(controller.updateStatus('invalid-id', { status: 'PROCESSED' } as any)).rejects.toThrow(NotFoundException);
  });
});
