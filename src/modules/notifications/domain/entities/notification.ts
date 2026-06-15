import { NotificationError } from '../errors/notification.error';

export type NotificationPriority = 'normal' | 'important' | 'urgent';

export interface NotificationProps {
  id?: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  linkPath: string | null;
  priority: NotificationPriority;
  metadata: Record<string, unknown>;
  readAt: Date | null;
  archivedAt: Date | null;
  createdAt?: Date;
}

export class Notification {
  constructor(private readonly props: NotificationProps) {
    this.props.title = props.title.trim();
    this.props.message = props.message.trim();
    this.props.type = props.type.trim();
    if (!this.props.title || !this.props.message || !this.props.type) {
      throw new NotificationError(
        'INVALID_NOTIFICATION',
        'Thông báo phải có loại, tiêu đề và nội dung.',
      );
    }
  }

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get readAt() {
    return this.props.readAt;
  }
  get archivedAt() {
    return this.props.archivedAt;
  }

  markRead(now: Date) {
    this.props.readAt ??= now;
  }

  markUnread() {
    this.props.readAt = null;
  }

  archive(now: Date) {
    this.props.archivedAt ??= now;
  }

  toPrimitives(): NotificationProps {
    return { ...this.props, metadata: { ...this.props.metadata } };
  }
}
