import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common/interfaces';
import { Request } from 'express';
import Stripe from 'stripe';
import { Public } from '../common/decorators/public.decorator';
import { WebhookService } from './webhook.service';

/**
 * WebhookController handles Stripe webhook events.
 *
 * POST /api/v1/webhooks/stripe
 *
 * CRITICAL: This endpoint is @Public — Stripe cannot send JWT tokens.
 * Signature verification via raw body protects against spoofing.
 * Always returns 200 to Stripe regardless of internal processing outcome.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('stripe')
  @Public()
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Raw body not available');
    }

    let event: Stripe.Event;
    try {
      event = this.webhookService.verifyAndParse(req.rawBody, signature);
    } catch (err) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
    }

    // Always return 200 to Stripe (even if processing fails internally)
    // to prevent Stripe from retrying exponentially
    try {
      await this.webhookService.handleEvent(event);
    } catch (err) {
      // Log but don't throw — Stripe needs 200
      console.error('Webhook processing error:', err);
    }

    return { received: true };
  }
}
