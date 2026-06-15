import {
  Notification,
  NotificationPriority,
} from '../../domain/entities/notification';

export interface NotificationListFilter {
  page: number;
  limit: number;
  unreadOnly: boolean;
  type?: string;
  priority?: NotificationPriority;
}

export interface NotificationPage {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export interface NotificationLogView {
  id: string;
  notificationId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  eventType: string;
  notificationType: string;
  title: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export abstract class NotificationPersistencePort {
  abstract listForUser(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<NotificationPage>;
  abstract findForUser(
    notificationId: string,
    userId: string,
  ): Promise<Notification | null>;
  abstract save(notification: Notification): Promise<Notification>;
  abstract markAllRead(userId: string, now: Date): Promise<void>;
  abstract archiveAllRead(userId: string, now: Date): Promise<void>;
  abstract listLogs(input: {
    page: number;
    limit: number;
    eventType?: string;
    userId?: string;
  }): Promise<{ logs: NotificationLogView[]; total: number }>;
}
