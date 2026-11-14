import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
    const db = requireSupabase();
    const { data: user, error } = await db.from('users').select('id, name, email').eq('id', userId).maybeSingle();
    if (error || !user) return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });

    if (request.nextUrl.searchParams.get('include') !== 'dashboard') {
      return NextResponse.json({ success: true, data: user });
    }

    const [feedbackResult, answersResult, demosResult] = await Promise.all([
      db.from('feedback').select('id, type, message, rating, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(6),
      db.from('innovation_answers').select('user_id, field, level, answer, votes, ai_score, created_at').order('created_at', { ascending: false }).limit(1000),
      db.from('contacts').select('id, subject, status, created_at').eq('email', user.email).ilike('subject', 'Free demo booking%').order('created_at', { ascending: false }).limit(6),
    ]);

    if (feedbackResult.error || answersResult.error || demosResult.error) {
      throw feedbackResult.error ?? answersResult.error ?? demosResult.error;
    }

    const standings = new Map<string, { userId: string; points: number; votes: number; answerCount: number; firstCreatedAt: string }>();
    for (const item of answersResult.data ?? []) {
      const current = standings.get(item.user_id);
      const createdAt = item.created_at ?? '';
      standings.set(item.user_id, {
        userId: item.user_id,
        points: (current?.points ?? 0) + Number(item.ai_score ?? 0),
        votes: (current?.votes ?? 0) + Number(item.votes ?? 0),
        answerCount: (current?.answerCount ?? 0) + 1,
        firstCreatedAt: current?.firstCreatedAt && current.firstCreatedAt < createdAt ? current.firstCreatedAt : createdAt,
      });
    }

    const ranked = [...standings.values()]
      .sort((a, b) => b.points - a.points || b.votes - a.votes || a.firstCreatedAt.localeCompare(b.firstCreatedAt))
      .map((item, index) => ({ ...item, rank: index + 1 }));
    const standing = ranked.find((item) => item.userId === userId) ?? null;
    const answers = (answersResult.data ?? []).filter((item) => item.user_id === userId).slice(0, 6);
    const feedback = feedbackResult.data ?? [];
    const demos = demosResult.data ?? [];
    const ownerEmail = (process.env.OWNER_EMAIL ?? process.env.CONTACT_RECIPIENT_EMAIL ?? '').trim().toLowerCase();
    const isOwner = Boolean(ownerEmail && user.email.trim().toLowerCase() === ownerEmail);
    let ownerDashboard: { contacts: Array<{ id: string; name: string; email: string; subject: string; status: string; preferred_date: string | null; preferred_time: string | null; created_at: string }>; feedback: Array<{ id: string; user_name: string; type: string; rating: number; message: string; created_at: string }>; answers: Array<{ id: string; username: string; field: string; level: string; ai_score: number; created_at: string }>; analytics: Array<{ event_name: string; count: number }> } | null = null;

    if (isOwner) {
      const [contactsResult, ownerFeedbackResult, ownerAnswersResult, analyticsResult] = await Promise.all([
        db.from('contacts').select('id, name, email, subject, status, preferred_date, preferred_time, created_at').order('created_at', { ascending: false }).limit(16),
        db.from('feedback').select('id, user_name, type, rating, message, created_at').order('created_at', { ascending: false }).limit(16),
        db.from('innovation_answers').select('id, username, field, level, ai_score, created_at').order('created_at', { ascending: false }).limit(16),
        db.from('analytics_events').select('event_name').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString()).limit(1000),
      ]);
      if (contactsResult.error || ownerFeedbackResult.error || ownerAnswersResult.error || analyticsResult.error) {
        throw contactsResult.error ?? ownerFeedbackResult.error ?? ownerAnswersResult.error ?? analyticsResult.error;
      }

      const counts = new Map<string, number>();
      for (const item of analyticsResult.data ?? []) counts.set(item.event_name, (counts.get(item.event_name) ?? 0) + 1);
      ownerDashboard = {
        contacts: contactsResult.data ?? [],
        feedback: ownerFeedbackResult.data ?? [],
        answers: ownerAnswersResult.data ?? [],
        analytics: [...counts.entries()].map(([event_name, count]) => ({ event_name, count })).sort((a, b) => b.count - a.count),
      };
    }
    const badges: Array<{ name: string; description: string }> = [];

    if (answers.length > 0) badges.push({ name: 'First Contribution', description: 'Shared a real-world idea with the community.' });
    if (answers.length >= 3) badges.push({ name: 'Insight Builder', description: 'Contributed three or more answers.' });
    if (standing?.rank === 1) badges.push({ name: 'Visionary Thinker', description: 'Currently leading the community leaderboard.' });
    else if (standing?.rank === 2) badges.push({ name: 'Community Builder', description: 'Currently ranked second in the community.' });
    else if (standing?.rank === 3) badges.push({ name: 'Innovator Rising', description: 'Currently ranked third in the community.' });
    else if (standing && standing.rank <= 10) badges.push({ name: 'Top Ten', description: 'Currently among the top ten contributors.' });
    if (feedback.length > 0) badges.push({ name: 'Community Voice', description: 'Shared feedback to help JVerse improve.' });
    if (demos.length > 0) badges.push({ name: 'Demo Explorer', description: 'Requested a closer look at a JVerse project.' });

    return NextResponse.json({
      success: true,
      data: user,
      dashboard: {
        stats: {
          answers: standing?.answerCount ?? 0,
          points: standing?.points ?? 0,
          rank: standing?.rank ?? null,
          participants: ranked.length,
          feedback: feedback.length,
          demos: demos.length,
        },
        badges,
        answers,
        feedback,
        demos,
        owner: ownerDashboard,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ success: false, message: 'Auth check failed.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 });

    const { name } = await request.json();
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return NextResponse.json({ success: false, message: 'Name must be between 2 and 80 characters.' }, { status: 400 });
    }

    const db = requireSupabase();
    const { data: user, error } = await db
      .from('users')
      .update({ name: trimmedName })
      .eq('id', userId)
      .select('id, name, email')
      .single();

    if (error || !user) throw error ?? new Error('User not found.');

    const [feedbackUpdate, innovationUpdate] = await Promise.all([
      db.from('feedback').update({ user_name: trimmedName }).eq('user_id', userId),
      db.from('innovation_answers').update({ username: trimmedName }).eq('user_id', userId),
    ]);

    if (feedbackUpdate.error || innovationUpdate.error) {
      throw feedbackUpdate.error ?? innovationUpdate.error;
    }

    return NextResponse.json({ success: true, message: 'Your profile has been updated.', data: user });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, message: 'Unable to update your profile.' }, { status: 500 });
  }
}
