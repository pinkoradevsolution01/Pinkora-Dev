import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { requireSupabase } from '@/lib/supabase';

export function GET() {
  return NextResponse.json({ status: 'OK', timestamp: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const limit = checkRateLimit(request, 'analytics', { limit: 90, windowMs: 60 * 60 * 1_000 });
  if (!limit.allowed) return NextResponse.json({ success: false }, { status: 429, headers: rateLimitHeaders(limit) });

  try {
    const body = await request.json() as { event?: unknown; path?: unknown; metadata?: unknown };
    const eventName = typeof body.event === 'string' ? body.event.trim() : '';
    const path = typeof body.path === 'string' ? body.path.trim() : '';
    const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {};
    const metadataSize = JSON.stringify(metadata).length;

    if (!/^[a-z0-9:_-]{1,80}$/i.test(eventName) || !path.startsWith('/') || path.length > 240 || metadataSize > 400) {
      return NextResponse.json({ success: false }, { status: 400, headers: rateLimitHeaders(limit) });
    }

    const { error } = await requireSupabase().from('analytics_events').insert([{ event_name: eventName, path, metadata }]);
    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 202, headers: rateLimitHeaders(limit) });
  } catch (error) {
    console.error('Analytics event error:', error);
    return NextResponse.json({ success: false }, { status: 503, headers: rateLimitHeaders(limit) });
  }
}
