import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createCalendarInvite, createCalendarUid, createRescheduleToken, hashRescheduleToken } from '@/lib/calendar';
import { getMailTransport } from '@/lib/mailer';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { requireSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value: unknown): value is string => typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);

function projectFromSubject(subject: string) {
  return subject.replace(/^Free demo booking\s*[—-]\s*/i, '').trim() || 'JVerse project';
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('reschedule') ?? '';
  if (token.length < 32) return NextResponse.json({ success: false, message: 'Booking not found.' }, { status: 404 });

  const limit = checkRateLimit(request, 'booking-lookup', { limit: 10, windowMs: 15 * 60 * 1_000 });
  if (!limit.allowed) return NextResponse.json({ success: false, message: 'Please try again shortly.' }, { status: 429, headers: rateLimitHeaders(limit) });

  try {
    const { data, error } = await requireSupabase()
      .from('contacts')
      .select('subject, preferred_date, preferred_time')
      .eq('reschedule_token_hash', hashRescheduleToken(token))
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, message: 'Booking not found.' }, { status: 404 });

    return NextResponse.json({ success: true, booking: { project: projectFromSubject(data.subject), preferredDate: data.preferred_date, preferredTime: data.preferred_time } });
  } catch (error) {
    console.error('Booking lookup error:', error);
    return NextResponse.json({ success: false, message: 'Unable to load this booking.' }, { status: 500 });
  }
}

async function rescheduleBooking(request: NextRequest, input: Record<string, unknown>) {
  const token = typeof input.rescheduleToken === 'string' ? input.rescheduleToken : '';
  if (token.length < 32 || !isDate(input.preferredDate) || !isTime(input.preferredTime)) {
    return NextResponse.json({ success: false, message: 'Choose a valid date and time to reschedule.' }, { status: 400 });
  }

  const limit = checkRateLimit(request, 'booking-reschedule', { limit: 5, windowMs: 60 * 60 * 1_000 });
  if (!limit.allowed) return NextResponse.json({ success: false, message: 'Too many reschedule attempts. Please try again later.' }, { status: 429, headers: rateLimitHeaders(limit) });

  const transporter = getMailTransport();
  const recipient = process.env.CONTACT_RECIPIENT_EMAIL ?? 'jaybe.gubot01@gmail.com';
  if (!transporter || !recipient) return NextResponse.json({ success: false, message: 'Booking email delivery is not configured yet.' }, { status: 503 });

  try {
    const db = requireSupabase();
    const { data: booking, error: lookupError } = await db
      .from('contacts')
      .select('id, name, email, subject, message, calendar_uid')
      .eq('reschedule_token_hash', hashRescheduleToken(token))
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!booking) return NextResponse.json({ success: false, message: 'Booking not found or no longer available for rescheduling.' }, { status: 404 });

    const project = projectFromSubject(booking.subject);
    const scheduleLine = `Preferred schedule (Philippine Time): ${input.preferredDate} at ${input.preferredTime}`;
    const previousMessage = booking.message.replace(/^Preferred schedule \(Philippine Time\):[^\n]*(?:\n\n)?/, '');
    const updatedMessage = `${scheduleLine}\n\n${previousMessage}`;
    const invite = createCalendarInvite({
      title: `JVerse demo — ${project}`,
      description: `Rescheduled JVerse demo for ${booking.name}.`,
      date: input.preferredDate,
      time: input.preferredTime,
      uid: booking.calendar_uid ?? createCalendarUid(),
    });

    const { error: updateError } = await db.from('contacts').update({
      preferred_date: input.preferredDate,
      preferred_time: input.preferredTime,
      calendar_uid: invite.uid,
      message: updatedMessage,
      updated_at: new Date().toISOString(),
    }).eq('id', booking.id);
    if (updateError) throw updateError;

    const attachment = { filename: 'jverse-demo-rescheduled.ics', content: invite.content, contentType: 'text/calendar; charset=utf-8; method=PUBLISH' };
    await Promise.all([
      transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER,
        to: recipient,
        replyTo: booking.email,
        subject: `[JVerse demo rescheduled] ${project}`,
        text: `A JVerse demo has been rescheduled.\n\nName: ${booking.name}\nEmail: ${booking.email}\nProject: ${project}\nNew schedule: ${input.preferredDate} at ${input.preferredTime} Philippine Time.`,
        attachments: [attachment],
      }),
      transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER,
        to: booking.email,
        replyTo: recipient,
        subject: `Your JVerse demo has been rescheduled — ${project}`,
        text: `Hi ${booking.name},\n\nYour JVerse demo request for ${project} is now scheduled for ${input.preferredDate} at ${input.preferredTime} Philippine Time. A calendar invitation is attached.\n\nJay-Be will confirm the final meeting details with you.`,
        attachments: [attachment],
      }),
    ]);

    return NextResponse.json({ success: true, message: 'Your demo schedule has been updated and a new calendar invitation has been emailed to you.' }, { headers: rateLimitHeaders(limit) });
  } catch (error) {
    console.error('Booking reschedule error:', error);
    return NextResponse.json({ success: false, message: 'We could not update your booking. Please try again later.' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as Record<string, unknown>;
    if (input.action === 'reschedule') return rescheduleBooking(request, input);

    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ success: false, message: 'Please sign in before sending a message.' }, { status: 401 });
    const limit = checkRateLimit(request, 'contact', { limit: 5, windowMs: 60 * 60 * 1_000 }, userId);
    if (!limit.allowed) return NextResponse.json({ success: false, message: 'Too many messages from this connection. Please try again later.' }, { status: 429, headers: rateLimitHeaders(limit) });

    const phone = typeof input.phone === 'string' ? input.phone : '';
    const subject = typeof input.subject === 'string' ? input.subject : '';
    const message = typeof input.message === 'string' ? input.message : '';
    const preferredDate = input.preferredDate;
    const preferredTime = input.preferredTime;
    if (!subject || !message) return NextResponse.json({ success: false, message: 'Please fill in all required fields.' }, { status: 400 });
    if (message.trim().length < 10) return NextResponse.json({ success: false, message: 'Message must be at least 10 characters.' }, { status: 400 });
    if (message.trim().length > 5_000 || subject.trim().length > 180 || phone.trim().length > 40 || (preferredDate && String(preferredDate).length > 10) || (preferredTime && String(preferredTime).length > 5)) return NextResponse.json({ success: false, message: 'Please shorten the submitted details and try again.' }, { status: 400 });

    const transporter = getMailTransport();
    const recipient = process.env.CONTACT_RECIPIENT_EMAIL ?? 'jaybe.gubot01@gmail.com';
    if (!transporter || !recipient) {
      return NextResponse.json({ success: false, message: 'Contact email delivery is not configured yet. Please email us directly.' }, { status: 503 });
    }

    const { data: user, error: userError } = await requireSupabase().from('users').select('name, email').eq('id', userId).maybeSingle();
    if (userError || !user) return NextResponse.json({ success: false, message: 'Your account could not be verified.' }, { status: 401 });
    const cleanName = user.name.trim();
    const cleanEmail = user.email.trim().toLowerCase();
    const cleanPhone = phone.trim() || null;
    const cleanSubject = subject.trim();
    const cleanPreferredDate = isDate(preferredDate) ? preferredDate : null;
    const cleanPreferredTime = isTime(preferredTime) ? preferredTime : null;
    const isDemoBooking = /^Free demo booking/i.test(cleanSubject);
    if (isDemoBooking && (!cleanPreferredDate || !cleanPreferredTime)) {
      return NextResponse.json({ success: false, message: 'Please choose both a preferred demo date and time.' }, { status: 400 });
    }
    const cleanMessage = [
      cleanPreferredDate || cleanPreferredTime ? `Preferred schedule (Philippine Time): ${cleanPreferredDate ?? 'Date not provided'}${cleanPreferredTime ? ` at ${cleanPreferredTime}` : ''}` : '',
      message.trim(),
    ].filter(Boolean).join('\n\n');
    const calendarUid = isDemoBooking ? createCalendarUid() : null;
    const rescheduleToken = isDemoBooking ? createRescheduleToken() : null;
    const { data, error } = await requireSupabase().from('contacts').insert([{
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      subject: cleanSubject,
      message: cleanMessage,
      status: 'new',
      preferred_date: cleanPreferredDate,
      preferred_time: cleanPreferredTime,
      calendar_uid: calendarUid,
      reschedule_token_hash: rescheduleToken ? hashRescheduleToken(rescheduleToken) : null,
    }]).select().single();
    if (error) throw error;

    await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER,
      to: recipient,
      replyTo: cleanEmail,
      subject: `[JVerse contact] ${cleanSubject.replace(/[\r\n]+/g, ' ')}`,
      text: [
        'New JVerse contact message',
        '',
        `Name: ${cleanName}`,
        `Email: ${cleanEmail}`,
        `Phone: ${cleanPhone ?? 'Not provided'}`,
        `Subject: ${cleanSubject}`,
        `Preferred date: ${cleanPreferredDate ?? 'Not provided'} (Philippine Time)`,
        `Preferred time: ${cleanPreferredTime ?? 'Not provided'} (Philippine Time)`,
        '',
        cleanMessage,
      ].join('\n'),
    });

    const appUrl = (process.env.APP_URL ?? request.nextUrl.origin).replace(/\/$/, '');
    const rescheduleUrl = rescheduleToken ? `${appUrl}/portfolio?reschedule=${encodeURIComponent(rescheduleToken)}` : null;
    if (isDemoBooking && cleanPreferredDate && cleanPreferredTime && calendarUid && rescheduleUrl) {
      const project = projectFromSubject(cleanSubject);
      const invite = createCalendarInvite({
        title: `JVerse demo — ${project}`,
        description: `JVerse demo request for ${cleanName}.`,
        date: cleanPreferredDate,
        time: cleanPreferredTime,
        uid: calendarUid,
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER,
        to: cleanEmail,
        replyTo: recipient,
        subject: `Your JVerse demo request — ${project}`,
        text: [
          `Hi ${cleanName},`,
          '',
          `Your preferred demo time for ${project} is ${cleanPreferredDate} at ${cleanPreferredTime} Philippine Time.`,
          'Jay-Be will confirm the final meeting details with you.',
          '',
          'A calendar invitation is attached. Need another time?',
          `Reschedule securely: ${rescheduleUrl}`,
        ].join('\n'),
        attachments: [{ filename: 'jverse-demo.ics', content: invite.content, contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }],
      });
    }

    return NextResponse.json({ success: true, message: isDemoBooking ? 'Your demo request and calendar invitation have been sent. Jay-Be will confirm the final meeting details with you soon.' : 'Your message has been sent. Jay-Be will get back to you soon!', data: { id: data.id, createdAt: data.created_at, rescheduleUrl } }, { status: 201, headers: rateLimitHeaders(limit) });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ success: false, message: 'We could not deliver your message. Please try again or email Jay-Be directly.' }, { status: 502 });
  }
}
