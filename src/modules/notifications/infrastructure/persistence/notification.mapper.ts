import { NotificationOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { Notification } from '../../domain/entities/notification';

export class NotificationMapper {
  static toDomain(entity: NotificationOrmEntity): Notification {
    return new Notification({
      id: entity.id,
      userId: entity.userId,
      type: entity.type,
      title: entity.title,
      message: entity.message,
      linkPath: entity.linkPath,
      priority: entity.priority,
      metadata: entity.metadata ?? {},
      readAt: entity.readAt,
      archivedAt: entity.archivedAt,
      createdAt: entity.createdAt,
    });
  }

  static toOrm(
    notification: Notification,
    target = new NotificationOrmEntity(),
  ): NotificationOrmEntity {
    const props = notification.toPrimitives();
    if (props.id) target.id = props.id;
    target.userId = props.userId;
    target.type = props.type;
    target.title = props.title;
    target.message = props.message;
    target.linkPath = props.linkPath;
    target.priority = props.priority;
    target.metadata = props.metadata;
    target.readAt = props.readAt;
    target.archivedAt = props.archivedAt;
    return target;
  }
}
