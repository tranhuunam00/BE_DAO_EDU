import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/value-objects/role.enum';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import {
  ArchiveNotificationUseCase,
  ArchiveReadNotificationsUseCase,
  ListMyNotificationsUseCase,
  ListNotificationLogsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
  MarkNotificationUnreadUseCase,
} from '../../modules/notifications/application/use-cases/manage-notifications.use-cases';
import type { NotificationPriority } from '../../modules/notifications/domain/entities/notification';
import { NotificationError } from '../../modules/notifications/domain/errors/notification.error';

interface AuthenticatedRequest {
  user: { sub: string; role: Role };
}

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(
    private readonly listMine: ListMyNotificationsUseCase,
    private readonly markReadUseCase: MarkNotificationReadUseCase,
    private readonly markUnreadUseCase: MarkNotificationUnreadUseCase,
    private readonly archiveUseCase: ArchiveNotificationUseCase,
    private readonly markAllReadUseCase: MarkAllNotificationsReadUseCase,
    private readonly archiveReadUseCase: ArchiveReadNotificationsUseCase,
    private readonly listLogsUseCase: ListNotificationLogsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thông báo của tài khoản hiện tại' })
  findMine(
    @Request() req: AuthenticatedRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @Query('unreadOnly') unreadOnly = 'false',
    @Query('type') type?: string,
    @Query('priority') priority?: NotificationPriority,
  ) {
    return this.listMine.execute(req.user.sub, {
      page: positiveInt(page, 1),
      limit: Math.min(positiveInt(limit, 30), 100),
      unreadOnly: unreadOnly === 'true',
      type,
      priority,
    });
  }

  @Patch(':id/read')
  markRead(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.run(() => this.markReadUseCase.execute(id, req.user.sub));
  }

  @Patch(':id/unread')
  markUnread(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.run(() => this.markUnreadUseCase.execute(id, req.user.sub));
  }

  @Patch(':id/archive')
  archive(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.run(() => this.archiveUseCase.execute(id, req.user.sub));
  }

  @Patch('read-all')
  markAllRead(@Request() req: AuthenticatedRequest) {
    return this.markAllReadUseCase.execute(req.user.sub);
  }

  @Patch('archive-read')
  archiveRead(@Request() req: AuthenticatedRequest) {
    return this.archiveReadUseCase.execute(req.user.sub);
  }

  @Get('logs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin tra cứu audit log thông báo' })
  listLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @Query('eventType') eventType?: string,
    @Query('userId') userId?: string,
  ) {
    return this.listLogsUseCase.execute({
      page: positiveInt(page, 1),
      limit: Math.min(positiveInt(limit, 30), 100),
      eventType,
      userId,
    });
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof NotificationError &&
        error.code === 'NOTIFICATION_NOT_FOUND'
      ) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}

function positiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
