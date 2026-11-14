'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackAnalyticsEvent } from '@/lib/analytics-client';

export function SiteAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    trackAnalyticsEvent('page_view');
  }, [pathname]);

  useEffect(() => {
    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; metadata?: Record<string, string | number | boolean> }>).detail;
      if (detail?.name) trackAnalyticsEvent(detail.name, detail.metadata);
    };
    window.addEventListener('jverse-analytics', handleEvent);
    return () => window.removeEventListener('jverse-analytics', handleEvent);
  }, []);

  return null;
}
