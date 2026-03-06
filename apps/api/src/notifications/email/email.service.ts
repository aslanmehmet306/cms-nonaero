import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailer: MailerService) {}

  /**
   * Send an email using a named handlebars template.
   *
   * @param params.to - Recipient email address
   * @param params.subject - Email subject line
   * @param params.template - Template name without .hbs extension
   * @param params.context - Template variables for handlebars rendering
   */
  async sendTemplate(params: {
    to: string;
    subject: string;
    template: string;
    context: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.mailer.sendMail({
        to: params.to,
        subject: params.subject,
        template: params.template,
        context: params.context,
      });
      this.logger.log(`Email sent: ${params.subject} to ${params.to}`);
    } catch (err) {
      this.logger.error(`Email send failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
