import { NotificationController } from '../../../../src/presentation/controllers/notification.controller';
import { Role } from '../../../../src/domain/value-objects/role.enum';
import { NotificationError } from '../../../../src/modules/notifications/domain/errors/notification.error';
import { NotFoundException } from '@nestjs/common';

describe('NotificationController', () => {
  let controller: NotificationController;
  let listMine: { execute: jest.Mock };
  let markReadUseCase: { execute: jest.Mock };
  let markUnreadUseCase: { execute: jest.Mock };
  let archiveUseCase: { execute: jest.Mock };
  let markAllReadUseCase: { execute: jest.Mock };
  let archiveReadUseCase: { execute: jest.Mock };
  let listLogsUseCase: { execute: jest.Mock };

  beforeEach(() => {
    listMine = { execute: jest.fn() };
    markReadUseCase = { execute: jest.fn() };
    markUnreadUseCase = { execute: jest.fn() };
    archiveUseCase = { execute: jest.fn() };
    markAllReadUseCase = { execute: jest.fn() };
    archiveReadUseCase = { execute: jest.fn() };
    listLogsUseCase = { execute: jest.fn() };

    controller = new NotificationController(
      listMine as any,
      markReadUseCase as any,
      markUnreadUseCase as any,
      archiveUseCase as any,
      markAllReadUseCase as any,
      archiveReadUseCase as any,
      listLogsUseCase as any,
    );
  });

  const req = { user: { sub: 'user-1', role: Role.STUDENT } };

  it('lists notifications for current user with parsed query options', async () => {
    listMine.execute.mockResolvedValue({ items: [], total: 0 });

    const result = await controller.findMine(req as any, '1', '20', 'true', 'ASSIGNMENT');
    expect(listMine.execute).toHaveBeenCalledWith('user-1', {
      page: 1,
      limit: 20,
      unreadOnly: true,
      type: 'ASSIGNMENT',
      priority: undefined,
    });
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('marks notification as read', async () => {
    markReadUseCase.execute.mockResolvedValue({ id: 'notif-1', isRead: true });

    const result = await controller.markRead(req as any, 'notif-1');
    expect(markReadUseCase.execute).toHaveBeenCalledWith('notif-1', 'user-1');
    expect(result).toEqual({ id: 'notif-1', isRead: true });
  });

  it('marks notification as unread', async () => {
    markUnreadUseCase.execute.mockResolvedValue({ id: 'notif-1', isRead: false });

    const result = await controller.markUnread(req as any, 'notif-1');
    expect(markUnreadUseCase.execute).toHaveBeenCalledWith('notif-1', 'user-1');
    expect(result).toEqual({ id: 'notif-1', isRead: false });
  });

  it('archives notification', async () => {
    archiveUseCase.execute.mockResolvedValue({ id: 'notif-1', isArchived: true });

    const result = await controller.archive(req as any, 'notif-1');
    expect(archiveUseCase.execute).toHaveBeenCalledWith('notif-1', 'user-1');
    expect(result).toEqual({ id: 'notif-1', isArchived: true });
  });

  it('marks all notifications as read', async () => {
    markAllReadUseCase.execute.mockResolvedValue({ count: 5 });

    const result = await controller.markAllRead(req as any);
    expect(markAllReadUseCase.execute).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ count: 5 });
  });

  it('archives all read notifications', async () => {
    archiveReadUseCase.execute.mockResolvedValue({ count: 3 });

    const result = await controller.archiveRead(req as any);
    expect(archiveReadUseCase.execute).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ count: 3 });
  });

  it('lists notification audit logs for admin', async () => {
    listLogsUseCase.execute.mockResolvedValue({ logs: [], total: 0 });

    const result = await controller.listLogs('1', '30', 'DELIVERED', 'user-1');
    expect(listLogsUseCase.execute).toHaveBeenCalledWith({
      page: 1,
      limit: 30,
      eventType: 'DELIVERED',
      userId: 'user-1',
    });
    expect(result).toEqual({ logs: [], total: 0 });
  });

  it('throws NotFoundException when NotificationError.NOTIFICATION_NOT_FOUND occurs', async () => {
    markReadUseCase.execute.mockRejectedValue(new NotificationError('NOTIFICATION_NOT_FOUND', 'Not found'));

    await expect(controller.markRead(req as any, 'invalid-id')).rejects.toThrow(NotFoundException);
  });
});
