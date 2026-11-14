'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics-client';

const demoProjects = ['Smart Monitoring System', 'EduKonekta'] as const;
const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL;
type DemoProject = (typeof demoProjects)[number];
type RescheduleBooking = { token: string; project: DemoProject; preferredDate: string | null; preferredTime: string | null };

export function DemoBooking({ project }: { project: DemoProject }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<RescheduleBooking | null>(null);
  const [rescheduleUrl, setRescheduleUrl] = useState('');

  useEffect(() => {
    let active = true;
    async function loadAccount() {
      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        if (active) setIsSignedIn(Boolean(response.ok && data.success));
      } catch {
        if (active) setIsSignedIn(false);
      }
    }
    void loadAccount();
    window.addEventListener('jverse-auth-change', loadAccount);
    return () => { active = false; window.removeEventListener('jverse-auth-change', loadAccount); };
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('reschedule');
    if (!token) return;

    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/contact-form?reschedule=${encodeURIComponent(token)}`);
        const data = await response.json();
        const booking = data.booking as Omit<RescheduleBooking, 'token'> | undefined;
        if (!active || !response.ok || !data.success || booking?.project !== project) return;
        setRescheduleBooking({ ...booking, token });
        setOpen(true);
      } catch {
        // The regular booking form remains available when a reschedule link cannot be loaded.
      }
    })();
    return () => { active = false; };
  }, [project]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const selectedProject = String(values.get('project') ?? project);
    const organization = String(values.get('organization') ?? '').trim();
    const preferredDate = String(values.get('preferredDate') ?? '').trim();
    const preferredTime = String(values.get('preferredTime') ?? '').trim();
    const message = String(values.get('message') ?? '').trim();
    const payload = rescheduleBooking
      ? { action: 'reschedule', rescheduleToken: rescheduleBooking.token, preferredDate, preferredTime }
      : {
        name: values.get('name'),
        email: values.get('email'),
        phone: values.get('phone'),
        preferredDate,
        preferredTime,
        subject: `Free demo booking — ${selectedProject}`,
        message: [
          `Project selected: ${selectedProject}`,
          `Organization: ${organization || 'Not provided'}`,
          '',
          message,
        ].join('\n'),
      };

    setSending(true);
    setStatus('');
    try {
      const response = await fetch('/api/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* Legacy booking payload retained for source compatibility; reschedule-safe payload follows.
        legacyBody: JSON.stringify({
          name: values.get('name'),
          email: values.get('email'),
          phone: values.get('phone'),
          preferredDate,
          preferredTime,
          subject: `Free demo booking — ${selectedProject}`,
          message: [
            `Project selected: ${selectedProject}`,
            `Organization: ${organization || 'Not provided'}`,
            '',
            message,
          ].join('\n'),
        }),
        */
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setStatus(data.message ?? 'Unable to send your demo request.');
      if (response.ok && data.success) {
        trackAnalyticsEvent(rescheduleBooking ? 'demo_rescheduled' : 'demo_booking_submit', { project: selectedProject });
        if (typeof data.data?.rescheduleUrl === 'string') setRescheduleUrl(data.data.rescheduleUrl);
        if (!rescheduleBooking) form.reset();
      }
    } catch {
      setStatus('Unable to send your demo request. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function openBooking() {
    if (!isSignedIn) {
      setStatus('Please sign in or create a JVerse account before booking a free demo.');
      return;
    }
    setStatus('');
    trackAnalyticsEvent('demo_booking_open', { project });
    setOpen(true);
  }

  return <>
    <button className="next-button next-button-primary next-demo-book-button" type="button" onClick={openBooking}>Book a free demo</button>
    {!isSignedIn && status && <p className="next-form-message">{status} <Link href="/my-account?mode=register">Sign up or sign in</Link></p>}
    {open && <div className="next-demo-modal-backdrop" role="presentation">
      <section className="next-demo-modal" role="dialog" aria-modal="true" aria-labelledby={`demo-booking-${project.replace(/ /g, '-').toLowerCase()}`}>
        <button className="next-demo-modal-close" type="button" aria-label="Close demo booking form" onClick={() => setOpen(false)}>×</button>
        <span className="next-eyebrow">JVerse portfolio</span>
        <h2 id={`demo-booking-${project.replace(/ /g, '-').toLowerCase()}`}>{rescheduleBooking ? 'Reschedule your demo' : 'Book a free demo'}</h2>
        <p>{rescheduleBooking ? 'Choose another preferred time and JVerse will email you an updated calendar invitation.' : <>Tell Jay-Be what you would like to explore. Your request will be sent directly to <strong>jaybe.gubot01@gmail.com</strong>.</>}</p>
        {!rescheduleBooking && calendlyUrl && <a className="next-text-link" href={calendlyUrl} target="_blank" rel="noreferrer">View live calendar availability ↗</a>}
        <form className="next-demo-booking-form" onSubmit={submit}>
          <label>Project<select name="project" defaultValue={project}>{demoProjects.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <div className="next-demo-form-grid">
            <label>Name<input required={!rescheduleBooking} name="name" placeholder="Your name" /></label>
            <label>Email<input required={!rescheduleBooking} type="email" name="email" placeholder="you@example.com" /></label>
          </div>
          <div className="next-demo-form-grid">
            <label>Phone <span>Optional</span><input name="phone" placeholder="+63 900 000 0000" /></label>
            <label>Organization <span>Optional</span><input name="organization" placeholder="Business or school" /></label>
          </div>
          <div className="next-demo-form-grid">
            <label>Preferred date <span>Philippine Time</span><input required type="date" name="preferredDate" min={new Date().toISOString().slice(0, 10)} defaultValue={rescheduleBooking?.preferredDate ?? ''} /></label>
            <label>Preferred time <span>Philippine Time</span><input required type="time" name="preferredTime" defaultValue={rescheduleBooking?.preferredTime ?? ''} /></label>
          </div>
          <label>What would you like to see?<textarea required={!rescheduleBooking} name="message" minLength={10} rows={4} placeholder="Tell us about your goals, workflow, or questions for the demo..." /></label>
          {status && <p className="next-form-message" role="status">{status}</p>}
          {rescheduleUrl && <a className="next-text-link" href={rescheduleUrl}>Manage or reschedule this booking</a>}
          <button className="next-button next-button-primary" disabled={sending}>{sending ? 'Sending request...' : rescheduleBooking ? 'Update demo schedule' : 'Send demo request'}</button>
        </form>
      </section>
    </div>}
  </>;
}
