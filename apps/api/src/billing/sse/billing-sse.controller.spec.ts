import { Test, TestingModule } from '@nestjs/testing';
import { MessageEvent } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BillingSseController } from './billing-sse.controller';
import { BillingRunProgressEvent } from '../events/billing-run-progress.event';

describe('BillingSseController', () => {
  let controller: BillingSseController;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    eventEmitter = new EventEmitter2();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingSseController],
      providers: [{ provide: EventEmitter2, useValue: eventEmitter }],
    }).compile();

    controller = module.get<BillingSseController>(BillingSseController);
  });

  describe('progress SSE', () => {
    it('should return Observable that emits MessageEvent when billing.progress event fires', (done) => {
      const billingRunId = 'run-uuid-1';
      const observable = controller.progress(billingRunId, '');

      const emitted: MessageEvent[] = [];

      observable.subscribe({
        next: (event: MessageEvent) => {
          emitted.push(event);
          if (emitted.length === 1) {
            expect(event).toHaveProperty('data');
            const parsed = JSON.parse(event.data as string);
            expect(parsed.billingRunId).toBe(billingRunId);
            expect(parsed.phase).toBe('scoping');
            expect(parsed.progress).toBe(10);
            done();
          }
        },
      });

      // Emit a matching event
      eventEmitter.emit(
        'billing.progress',
        new BillingRunProgressEvent(billingRunId, 'scoping', 10, 'Scoping...'),
      );
    });

    it('should filter events to only the requested billingRunId', (done) => {
      const targetRunId = 'run-uuid-target';
      const otherRunId = 'run-uuid-other';
      const observable = controller.progress(targetRunId, '');

      const emitted: MessageEvent[] = [];

      observable.subscribe({
        next: (event: MessageEvent) => {
          emitted.push(event);
          const parsed = JSON.parse(event.data as string);
          // Should only see events for targetRunId
          expect(parsed.billingRunId).toBe(targetRunId);
          done();
        },
      });

      // Emit event for other run first (should be filtered out)
      eventEmitter.emit(
        'billing.progress',
        new BillingRunProgressEvent(otherRunId, 'scoping', 10, 'Other run'),
      );

      // Small delay then emit for target run
      setTimeout(() => {
        eventEmitter.emit(
          'billing.progress',
          new BillingRunProgressEvent(targetRunId, 'calculating', 50, 'Target run'),
        );
      }, 10);
    });

    it('should be decorated with @Public() (bypasses JWT)', () => {
      // Check the metadata on the progress method of the class prototype
      const metadata = Reflect.getMetadata(
        'isPublic',
        BillingSseController.prototype.progress,
      );
      expect(metadata).toBe(true);
    });
  });
});
