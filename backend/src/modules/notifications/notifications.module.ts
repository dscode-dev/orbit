import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import {
  EmailNotificationProvider,
  PushNotificationProvider,
} from './notification-delivery.providers';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

@Module({
  imports: [IdentityModule],
  controllers: [NotificationController],
  providers: [
    NotificationRepository,
    NotificationService,
    NotificationGateway,
    EmailNotificationProvider,
    PushNotificationProvider,
  ],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationsModule {}
