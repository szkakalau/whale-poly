'use client';

import { useEffect, useMemo } from 'react';
import { trackEvent, type AnalyticsPayload } from '@/lib/analytics';

type TrackPageEventProps = {
  name: string;
  payload?: AnalyticsPayload;
  dedupeKey?: string;
};

export default function TrackPageEvent({ name, payload = {}, dedupeKey }: TrackPageEventProps) {
  const serializedPayload = useMemo(() => JSON.stringify(payload), [payload]);

  useEffect(() => {
    if (dedupeKey && typeof window !== 'undefined') {
      const existing = window.sessionStorage.getItem(dedupeKey);
      if (existing) return;
      window.sessionStorage.setItem(dedupeKey, '1');
    }

    trackEvent(name, payload);
  }, [dedupeKey, name, payload, serializedPayload]);

  return null;
}
