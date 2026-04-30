export type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsPayload = Record<string, AnalyticsValue>;

export function trackEvent(name: string, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') return;

  void import('@vercel/analytics')
    .then(({ track }) => track(name, payload))
    .catch(() => {
      /* ignore analytics failures */
    });
}
