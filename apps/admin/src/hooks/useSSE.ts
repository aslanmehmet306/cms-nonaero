import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

interface BillingProgress {
  billingRunId: string;
  status: string;
  processed: number;
  total: number;
  message?: string;
}

export function useBillingSSE(billingRunId: string | null) {
  const [progress, setProgress] = useState<BillingProgress | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!billingRunId) {
      setProgress(null);
      return;
    }

    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const url = `/api/v1/billing-runs/${billingRunId}/progress?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as BillingProgress;
        setProgress(data);
      } catch {
        // Ignore non-JSON messages
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [billingRunId]);

  return progress;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export function useNotificationSSE() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const url = `/api/v1/notifications/sse?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Notification;
        setNotifications((prev) => [data, ...prev]);
      } catch {
        // Ignore non-JSON messages
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  return notifications;
}
