// POST /api/notifications/payment-alerts  →  send payment alert email(s)
import { Controller, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('payment-alerts')
  sendPaymentAlerts() {
    return this.notifications.sendPaymentAlerts();
  }
}
