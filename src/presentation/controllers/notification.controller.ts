/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NotificationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(
    @InjectRepository(NotificationOrmEntity)
    private readonly notificationRepo: Repository<NotificationOrmEntity>,
  ) {}

  @Get()
  async findMine(@Request() req: any) {
    const [notifications, unreadCount] = await Promise.all([
      this.notificationRepo.find({
        where: { userId: req.user.sub },
        order: { createdAt: 'DESC' },
        take: 30,
      }),
      this.notificationRepo.count({
        where: { userId: req.user.sub, readAt: IsNull() },
      }),
    ]);
    return { notifications, unreadCount };
  }

  @Patch(':id/read')
  async markRead(@Request() req: any, @Param('id') id: string) {
    await this.notificationRepo.update(
      { id, userId: req.user.sub },
      { readAt: new Date() },
    );
    return { success: true };
  }

  @Patch('read-all')
  async markAllRead(@Request() req: any) {
    await this.notificationRepo.update(
      { userId: req.user.sub, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { success: true };
  }
}
