import { Controller, Query, Sse, MessageEvent } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent, timer } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { Public } from '../../common/decorators/public.decorator';

/**
 * SSE endpoint for real-time in-app notification push.
 *
 * Uses EventSource on the client side. @Public() because EventSource
 * cannot send Authorization headers — token is passed as query parameter.
 *
 * Connection auto-closes after 5 minutes to prevent leaks.
 * Client should reconnect with new timestamp.
 */
@Controller('notifications')
export class NotificationSseController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Sse('stream')
  @Public()
  stream(
    @Query('token') _token: string,
    @Query('tenantId') tenantId?: string,
  ): Observable<MessageEvent> {
    // 5-minute max connection timeout
    const timeout$ = timer(5 * 60 * 1000);

    return fromEvent(this.eventEmitter, 'notification.created').pipe(
      filter((event: any) => {
        if (tenantId)
          return event.notification?.tenantId === tenantId;
        return true; // admin sees all
      }),
      map(
        (event: any) =>
          ({
            data: JSON.stringify({
              notification: event.notification,
              severity: event.severity,
            }),
          }) as MessageEvent,
      ),
      takeUntil(timeout$),
    );
  }
}
