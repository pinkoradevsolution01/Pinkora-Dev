import { createHash, randomBytes, randomUUID } from 'crypto';

type CalendarInvite = {
  title: string;
  description: string;
  date: string;
  time: string;
  uid?: string;
  durationMinutes?: number;
};

function icsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function formatIcsLocal(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}00`;
}

export function createRescheduleToken() {
  return randomBytes(32).toString('base64url');
}

export function hashRescheduleToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createCalendarUid() {
  return `${randomUUID()}@jverse.site`;
}

export function createCalendarInvite({ title, description, date, time, uid = createCalendarUid(), durationMinutes = 30 }: CalendarInvite) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const stamp = formatIcsLocal(new Date());

  return {
    uid,
    content: [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//JVerse//Demo Booking//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}Z`,
      `DTSTART;TZID=Asia/Manila:${formatIcsLocal(start)}`,
      `DTEND;TZID=Asia/Manila:${formatIcsLocal(end)}`,
      `SUMMARY:${icsText(title)}`,
      `DESCRIPTION:${icsText(description)}`,
      'STATUS:TENTATIVE',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n'),
  };
}
