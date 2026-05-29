import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { processHeartDeductions } from '@/lib/services/cronService';

const FINISHED_STATUSES = ['completed', 'failed', 'cancelled'];

const RESULT_FILTER_MAP: Record<string, string[]> = {
  success: ['completed'],
  game_over: ['failed'],
  cancelled: ['cancelled'],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id query parameter is required' }, { status: 400 });
  }

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
  const offset = (page - 1) * limit;
  const resultFilter = searchParams.get('result');

  // Lazy evaluation: ensure active challenges that have ended are transitioned to history
  if (process.env.NODE_ENV !== 'test') {
    await processHeartDeductions();
  }

  // Get lifetime stats
  const { rows: statsRows } = await query(
    `SELECT challenges_joined, challenges_completed, best_streak, total_checkins
     FROM user_stats WHERE user_id = $1`,
    [userId]
  );

  const stats = statsRows[0] || { challenges_joined: 0, challenges_completed: 0, best_streak: 0, total_checkins: 0 };

  // Build status filter
  let statusFilter = FINISHED_STATUSES;
  if (resultFilter && RESULT_FILTER_MAP[resultFilter]) {
    statusFilter = RESULT_FILTER_MAP[resultFilter];
  }

  // Count total finished challenges
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count
     FROM challenges c
     JOIN challenge_members cm ON cm.challenge_id = c.id
     WHERE cm.user_id = $1 AND cm.status = 'accepted' AND c.status = ANY($2::challenge_status[])`,
    [userId, statusFilter]
  );
  const total = countRows[0]?.count || 0;

  // Get paginated finished challenges
  const { rows: challenges } = await query(
    `SELECT c.id, c.title, c.status, c.end_reason, c.start_at, c.ended_at,
            c.current_step, c.duration_days, c.hearts_left,
            (SELECT COUNT(*)::int FROM challenge_members WHERE challenge_id = c.id AND status = 'accepted') AS member_count,
            u.username AS creator_username
     FROM challenges c
     JOIN challenge_members cm ON cm.challenge_id = c.id
     JOIN users u ON u.id = c.creator_id
     WHERE cm.user_id = $1 AND cm.status = 'accepted' AND c.status = ANY($2::challenge_status[])
     ORDER BY c.ended_at DESC NULLS LAST
     LIMIT $3 OFFSET $4`,
    [userId, statusFilter, limit, offset]
  );

  // Check which challenges have been recreated
  const challengeIds = challenges.map((c) => c.id as string);
  let recreatedSet = new Set<string>();
  if (challengeIds.length > 0) {
    const { rows: childRows } = await query(
      `SELECT parent_challenge_id FROM challenges WHERE parent_challenge_id = ANY($1::uuid[])`,
      [challengeIds]
    );
    recreatedSet = new Set(childRows.map((r) => r.parent_challenge_id as string));
  }

  const enrichedChallenges = challenges.map((c) => ({
    ...c,
    has_child_challenge: recreatedSet.has(c.id as string),
  }));

  return NextResponse.json({
    lifetime_stats: {
      total_challenges: stats.challenges_joined,
      total_completed: stats.challenges_completed,
      best_streak: stats.best_streak,
      total_checkins: stats.total_checkins,
    },
    challenges: enrichedChallenges,
    total,
    page,
    limit,
  });
}
