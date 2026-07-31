import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import webpush from 'web-push';

export type DeliveryResult = {
  status: 'SENT' | 'SKIPPED';
  provider: string;
  providerMessageId?: string;
};

@Injectable()
export class EmailNotificationProvider {
  private readonly logger = new Logger(EmailNotificationProvider.name);
  private readonly transporter?: Transporter;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
    }
  }

  async send(input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<DeliveryResult> {
    if (!this.transporter) {
      this.logger.warn('SMTP is not configured; email delivery skipped');
      return { status: 'SKIPPED', provider: 'smtp-unconfigured' };
    }
    const result: unknown = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'Orbit <no-reply@orbit.local>',
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return {
      status: 'SENT',
      provider: 'smtp',
      providerMessageId:
        typeof result === 'object' &&
        result !== null &&
        'messageId' in result &&
        typeof result.messageId === 'string'
          ? result.messageId
          : undefined,
    };
  }
}

@Injectable()
export class PushNotificationProvider {
  private readonly configured: boolean;

  constructor() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    this.configured = Boolean(publicKey && privateKey);
    if (publicKey && privateKey) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT ?? 'mailto:admin@orbit.local',
        publicKey,
        privateKey,
      );
    }
  }

  async send(
    subscription: {
      endpoint: string;
      p256dh: string;
      auth: string;
    },
    payload: Record<string, unknown>,
  ): Promise<DeliveryResult> {
    if (!this.configured)
      return { status: 'SKIPPED', provider: 'web-push-unconfigured' };
    const result = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60, urgency: 'normal' },
    );
    return {
      status: 'SENT',
      provider: 'web-push',
      providerMessageId: result.headers.location,
    };
  }
}
