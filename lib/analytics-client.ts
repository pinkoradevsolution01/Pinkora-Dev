'use client';

type AnalyticsMetadata = Record<string, string | number | boolean>;

export function trackAnalyticsEvent(event: string, metadata: AnalyticsMetadata = {}) {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify({ event, path: window.location.pathname, metadata });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/health', new Blob([payload], { type: 'application/json' }));
      return;
    }
    void fetch('/api/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
  } catch {
    // Analytics is optional and should never affect the visitor experience.
  }
}
