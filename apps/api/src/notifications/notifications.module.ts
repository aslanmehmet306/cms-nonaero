import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import * as path from 'path';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email/email.service';
import { NotificationsListener } from './notifications.listener';
import { NotificationSseController } from './sse/notification-sse.controller';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get('SMTP_HOST', 'localhost'),
          port: config.get<number>('SMTP_PORT', 1025),
          ignoreTLS: true, // Mailpit doesn't need TLS
        },
        defaults: {
          from: config.get('SMTP_FROM', 'noreply@airport-revenue.local'),
        },
        template: {
          dir: path.join(__dirname, 'email', 'templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController, NotificationSseController],
  providers: [NotificationsService, EmailService, NotificationsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
