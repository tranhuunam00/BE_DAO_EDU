import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, Not } from 'typeorm';
import { NotificationLogOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/notification-log.orm-entity';
import { NotificationOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { Notification } from '../../domain/entities/notification';
import {
  NotificationListFilter,
  NotificationPersistencePort,
} from '../../application/ports/notification-persistence.port';
import { NotificationMapper } from './notification.mapper';

@Injectable()
export class TypeOrmNotificationPersistenceAdapter extends NotificationPersistencePort {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async listForUser(userId: string, filter: NotificationListFilter) {
    const repository = this.dataSource.getRepository(NotificationOrmEntity);
    const query = repository
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .andWhere('notification.archived_at IS NULL')
      .orderBy(
        `CASE notification.priority WHEN 'urgent' THEN 1 WHEN 'important' THEN 2 ELSE 3 END`,
        'ASC',
      )
      .addOrderBy('notification.created_at', 'DESC')
      .skip((filter.page - 1) * filter.limit)
      .take(filter.limit);
    if (filter.unreadOnly) query.andWhere('notification.read_at IS NULL');
    if (filter.type) {
      query.andWhere('notification.type = :type', { type: filter.type });
    }
    if (filter.priority) {
      query.andWhere('notification.priority = :priority', {
        priority: filter.priority,
      });
    }
    const [entities, total, unreadCount] = await Promise.all([
      query.getMany(),
      query.clone().skip(undefined).take(undefined).getCount(),
      repository.count({
        where: { userId, readAt: IsNull(), archivedAt: IsNull() },
      }),
    ]);
    return {
      notifications: entities.map(NotificationMapper.toDomain),
      total,
      unreadCount,
      page: filter.page,
      limit: filter.limit,
    };
  }

  async findForUser(notificationId: string, userId: string) {
    const entity = await this.dataSource
      .getRepository(NotificationOrmEntity)
      .findOne({ where: { id: notificationId, userId, archivedAt: IsNull() } });
    return entity ? NotificationMapper.toDomain(entity) : null;
  }

  async save(notification: Notification) {
    const repository = this.dataSource.getRepository(NotificationOrmEntity);
    const logRepo = this.dataSource.getRepository(NotificationLogOrmEntity);
    const existing = notification.id
      ? await repository.findOneBy({ id: notification.id })
      : null;
      
    const savedOrm = await repository.save(
      NotificationMapper.toOrm(notification, existing ?? undefined),
    );

    // Ghi log trạng thái tự động
    try {
      let eventType = 'CREATED';
      let shouldLog = false;

      if (!existing) {
        eventType = 'CREATED';
        shouldLog = true;
      } else {
        if (!existing.readAt && savedOrm.readAt) {
          eventType = 'READ';
          shouldLog = true;
        } else if (existing.readAt && !savedOrm.readAt) {
          eventType = 'UNREAD';
          shouldLog = true;
        } else if (!existing.archivedAt && savedOrm.archivedAt) {
          eventType = 'ARCHIVED';
          shouldLog = true;
        }
      }

      if (shouldLog) {
        await logRepo.save({
          notificationId: savedOrm.id,
          userId: savedOrm.userId,
          eventType,
          notificationType: savedOrm.type || 'SYSTEM',
          title: savedOrm.title,
          metadata: { timestamp: new Date() },
        });
      }
    } catch (e) {
      console.error('Failed to save notification log:', e);
    }

    return NotificationMapper.toDomain(savedOrm);
  }

  async markAllRead(userId: string, now: Date) {
    const repository = this.dataSource.getRepository(NotificationOrmEntity);
    const logRepo = this.dataSource.getRepository(NotificationLogOrmEntity);
    
    // Tìm danh sách thông báo chưa đọc của user này để ghi log
    const unread = await repository.find({
      where: { userId, readAt: IsNull(), archivedAt: IsNull() },
    });

    await repository.update(
      { userId, readAt: IsNull(), archivedAt: IsNull() },
      { readAt: now },
    );

    if (unread.length > 0) {
      try {
        const logs = unread.map((n) => ({
          notificationId: n.id,
          userId: n.userId,
          eventType: 'READ',
          notificationType: n.type || 'SYSTEM',
          title: n.title,
          metadata: { batch: true, timestamp: now },
        }));
        await logRepo.save(logs);
      } catch (e) {
        console.error('Failed to log batch read notifications:', e);
      }
    }
  }

  async archiveAllRead(userId: string, now: Date) {
    const repository = this.dataSource.getRepository(NotificationOrmEntity);
    const logRepo = this.dataSource.getRepository(NotificationLogOrmEntity);

    // Tìm danh sách thông báo đã đọc chưa lưu trữ để ghi log
    const read = await repository.find({
      where: { userId, readAt: Not(IsNull()), archivedAt: IsNull() },
    });

    await this.dataSource
      .getRepository(NotificationOrmEntity)
      .createQueryBuilder()
      .update()
      .set({ archivedAt: now })
      .where('user_id = :userId', { userId })
      .andWhere('read_at IS NOT NULL')
      .andWhere('archived_at IS NULL')
      .execute();

    if (read.length > 0) {
      try {
        const logs = read.map((n) => ({
          notificationId: n.id,
          userId: n.userId,
          eventType: 'ARCHIVED',
          notificationType: n.type || 'SYSTEM',
          title: n.title,
          metadata: { batch: true, timestamp: now },
        }));
        await logRepo.save(logs);
      } catch (e) {
        console.error('Failed to log batch archive notifications:', e);
      }
    }
  }


  async listLogs(input: {
    page: number;
    limit: number;
    eventType?: string;
    userId?: string;
  }) {
    const query = this.dataSource
      .getRepository(NotificationLogOrmEntity)
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    if (input.eventType) {
      query.andWhere('log.event_type = :eventType', {
        eventType: input.eventType,
      });
    }
    if (input.userId) {
      query.andWhere('log.user_id = :userId', { userId: input.userId });
    }
    const [logs, total] = await query.getManyAndCount();
    return {
      logs: logs.map((log) => ({
        id: log.id,
        notificationId: log.notificationId,
        userId: log.userId,
        userName: log.user?.name ?? null,
        userEmail: log.user?.email ?? null,
        eventType: log.eventType,
        notificationType: log.notificationType,
        title: log.title,
        metadata: log.metadata ?? {},
        createdAt: log.createdAt,
      })),
      total,
    };
  }
}
