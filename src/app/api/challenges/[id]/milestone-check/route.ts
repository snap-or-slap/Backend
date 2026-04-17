import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const MILESTONE_DAYS = [7, 14, 30, 60, 100, 365];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: challengeId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id query parameter is required' }, { status: 400 });
  }

  // Get user stats
  const { rows: statsRows } = await query(
    `SELECT current_streak, best_streak FROM user_stats WHERE user_id = $1`,
    [userId]
  );

  const currentStreak = statsRows.length > 0 ? statsRows[0].current_streak : 0;
  const bestStreak = statsRows.length > 0 ? statsRows[0].best_streak : 0;

  // Check if current streak hits a milestone
  const milestoneHit = MILESTONE_DAYS.find(m => m === currentStreak);

  if (!milestoneHit) {
    return NextResponse.json({
      milestone_triggered: false,
      current_streak: currentStreak,
      best_streak: bestStreak,
      next_milestone: MILESTONE_DAYS.find(m => m > currentStreak) || null,
    });
  }

  // Check if this milestone was already triggered
  const { rows: existing } = await query(
    `SELECT id FROM notifications
     WHERE user_id = $1 AND type = 'streak_milestone'
       AND metadata->>'milestone_days' = $2`,
    [userId, String(milestoneHit)]
  );

  if (existing.length > 0) {
    return NextResponse.json({
      milestone_triggered: false,
      reason: 'Already triggered this milestone',
      current_streak: currentStreak,
      best_streak: bestStreak,
    });
  }

  // Create notification
  await query(
    `INSERT INTO notifications (user_id, type, metadata)
     VALUES ($1, 'streak_milestone', $2)`,
    [userId, JSON.stringify({ milestone_days: milestoneHit, challenge_id: challengeId })]
  );

  // Create activity
  await query(
    `INSERT INTO activities (user_id, type, metadata)
     VALUES ($1, 'streak_milestone', $2)`,
    [userId, JSON.stringify({ milestone_days: milestoneHit, challenge_id: challengeId })]
  );

  return NextResponse.json({
    milestone_triggered: true,
    milestone_days: milestoneHit,
    current_streak: currentStreak,
    best_streak: bestStreak,
    next_milestone: MILESTONE_DAYS.find(m => m > currentStreak) || null,
  });
}
