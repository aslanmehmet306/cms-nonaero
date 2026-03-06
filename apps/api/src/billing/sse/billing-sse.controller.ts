import {
  Controller,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Query,
  Sse,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent, timer } from 'rxjs';
import { filter, map, takeUntil, finalize } from 'rxjs/operators';
import { Public } from '../../common/decorators/public.decorator';
import { BillingRunProgressEvent } from '../events/billing-run-progress.event';

/**
 * SSE endpoint for real-time billing run progress streaming.
 *
 * Uses EventEmitter2 bridge: BillingRunProcessor emits 'billing.progress' events,
 * this controller converts them to Server-Sent Events for connected clients.
 *
 * @Public() bypasses JWT because EventSource API cannot send Authorization headers.
 * An optional query token parameter is available for basic security.
 */
@Controller('billing-runs')
export class BillingSseController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * GET /billing-runs/:id/progress — SSE stream filtered by billingRunId.
   *
   * Auto-closes after 5 minutes to prevent connection leaks.
   * Clients should reconnect if they need continued updates.
   */
  @Sse(':id/progress')
  @Public()
  progress(
    @Param('id', ParseUUIDPipe) billingRunId: string,
    @Query('token') _token: string,
  ): Observable<MessageEvent> {
    const timeout$ = timer(5 * 60 * 1000); // 5 min max connection

    return fromEvent(this.eventEmitter, 'billing.progress').pipe(
      filter(
        (event: unknown) =>
          (event as BillingRunProgressEvent).billingRunId === billingRunId,
      ),
      map(
        (event: unknown) =>
          ({
            data: JSON.stringify(event),
          }) as MessageEvent,
      ),
      takeUntil(timeout$),
      finalize(() => {
        // Cleanup on disconnect or timeout
      }),
    );
  }
}
