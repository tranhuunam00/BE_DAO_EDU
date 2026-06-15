import { NotificationError } from '../../domain/errors/notification.error';
import {
  NotificationListFilter,
  NotificationPersistencePort,
} from '../ports/notification-persistence.port';

export class ListMyNotificationsUseCase {
  constructor(private readonly persistence: NotificationPersistencePort) {}

  async execute(userId: string, filter: NotificationListFilter) {
    const page = await this.persistence.listForUser(userId, filter);
    return {
      ...page,
      notifications: page.notifications.map((item) => item.toPrimitives()),
    };
  }
}

export class MarkNotificationReadUseCase {
  constructor(private readonly persistence: NotificationPersistencePort) {}

  async execute(notificationId: string, userId: string) {
    const notification = await this.getOwned(notificationId, userId);
    notification.markRead(new Date());
    return (await this.persistence.save(notification)).toPrimitives();
  }

  private async getOwned(notificationId: string, userId: string) {
    const notification = await this.persistence.findForUser(
      notificationId,
      userId,
    );
    if (!notification) {
      throw new NotificationError(
        'NOTIFICATION_NOT_FOUND',
        'Không tìm thấy thông báo.',
      );
    }
    return notification;
  }
}

export class MarkNotificationUnreadUseCase {
  constructor(private readonly persistence: NotificationPersistencePort) {}

  async execute(notificationId: string, userId: string) {
    const notification = await this.persistence.findForUser(
      notificationId,
      userId,
    );
    if (!notification) {
      throw new NotificationError(
        'NOTIFICATION_NOT_FOUND',
        'Không tìm thấy thông báo.',
      );
    }
    notification.markUnread();
    return (await this.persistence.save(notification)).toPrimitives();
  }
}

export class ArchiveNotificationUseCase {
  constructor(private readonly persistence: NotificationPersistencePort) {}

  async execute(notificationId: string, userId: string) {
    const notification = await this.persistence.findForUser(
      notificationId,
      userId,
    );
    if (!notification) {
      throw new NotificationError(
        'NOTIFICATION_NOT_FOUND',
        'Không tìm thấy thông báo.',
      );
    }
    notification.archive(new Date());
    return (await this.persistence.save(notification)).toPrimitives();
  }
}

export class MarkAllNotificationsReadUseCase {
  constructor(private readonly persistence: NotificationPersistencePort) {}

  async execute(userId: string) {
    await this.persistence.markAllRead(userId, new Date());
    return { success: true };
  }
}

export class ArchiveReadNotificationsUseCase {
  constructor(private readonly persistence: NotificationPersistencePort) {}

  async execute(userId: string) {
    await this.persistence.archiveAllRead(userId, new Date());
    return { success: true };
  }
}

export class ListNotificationLogsUseCase {
  constructor(private readonly persistence: NotificationPersistencePort) {}

  execute(input: {
    page: number;
    limit: number;
    eventType?: string;
    userId?: string;
  }) {
    return this.persistence.listLogs(input);
  }
}
