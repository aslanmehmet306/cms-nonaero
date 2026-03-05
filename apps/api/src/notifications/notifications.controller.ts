import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * List notifications with query filters.
   */
  @Get()
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('isRead') isRead?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.findAll({
      tenantId,
      userId,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /notifications/poll
   * Polling fallback: get new notifications since a timestamp (30s interval from frontend).
   */
  @Get('poll')
  async poll(
    @Query('since') since?: string,
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.notificationsService.findAll({
      tenantId,
      userId,
      since,
      page: 1,
      limit: 50,
    });
  }

  /**
   * GET /notifications/unread-count
   * Return count of unread notifications for notification bell badge.
   */
  @Get('unread-count')
  async unreadCount(
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
  ) {
    const count = await this.notificationsService.getUnreadCount({
      tenantId,
      userId,
    });
    return { count };
  }

  /**
   * PATCH /notifications/mark-all-read
   * Mark all notifications as read for current user/tenant.
   */
  @Patch('mark-all-read')
  async markAllAsRead(
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
  ) {
    const result = await this.notificationsService.markAllAsRead({
      tenantId,
      userId,
    });
    return { updated: result.count };
  }

  /**
   * PATCH /notifications/:id/read
   * Mark single notification as read.
   */
  @Patch(':id/read')
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markAsRead(id);
  }
}
