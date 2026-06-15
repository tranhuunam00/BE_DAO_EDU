import { Notification } from './notification';

describe('Notification', () => {
  const create = () =>
    new Notification({
      id: 'notification-1',
      userId: 'user-1',
      type: 'assignment_published',
      title: ' Bài tập mới ',
      message: ' Đã có bài tập mới. ',
      linkPath: '/student/assignments',
      priority: 'important',
      metadata: {},
      readAt: null,
      archivedAt: null,
    });

  it('normalizes content and marks the notification as read once', () => {
    const notification = create();
    const firstReadAt = new Date('2026-06-15T03:00:00Z');
    notification.markRead(firstReadAt);
    notification.markRead(new Date('2026-06-15T04:00:00Z'));

    expect(notification.toPrimitives()).toMatchObject({
      title: 'Bài tập mới',
      message: 'Đã có bài tập mới.',
      readAt: firstReadAt,
    });
  });

  it('supports unread and archive transitions', () => {
    const notification = create();
    notification.markRead(new Date());
    notification.markUnread();
    const archivedAt = new Date('2026-06-15T05:00:00Z');
    notification.archive(archivedAt);

    expect(notification.readAt).toBeNull();
    expect(notification.archivedAt).toEqual(archivedAt);
  });
});
