import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const FINISHED_STATUSES = ['completed', 'failed', 'cancelled'];
const RECREATE_WINDOW_DAYS = 90;

function getResultBanner(status: string, endReason: string | null): string {
  if (status === 'completed') return 'CONGRATULATIONS';
  if (status === 'cancelled') return 'CANCELLED';
  return 'VALIANT_EFFORT';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id query parameter is required' }, { status: 400 });
  }

  // Fetch challenge
  const { rows } = await query(
    `SELECT id, title, description, status, end_reason, start_at, ended_at,
            duration_days, frequency, total_hearts, hearts_left, current_step,
            final_stats, parent_challenge_id, creator_id, cover_url
     FROM challenges WHERE id = $1`,
    [id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  }

  const challenge = rows[0];

  if (!FINISHED_STATUSES.includes(challenge.status)) {
    return NextResponse.json(
      { error: 'Challenge is not yet finished. Only completed, failed or cancelled challenges have history.' },
      { status: 409 }
    );
  }

  // Check user is a member
  const { rows: memberCheck } = await query(
    `SELECT user_id, status FROM challenge_members WHERE challenge_id = $1 AND user_id = $2`,
    [id, userId]
  );

  // Get members with checkin counts
  const { rows: members } = await query(
    `SELECT cm.user_id, u.username, u.display_name, u.avatar_url,
            (SELECT COUNT(*)::int FROM checkins WHERE challenge_id = $1 AND user_id = cm.user_id) AS checkin_count
     FROM challenge_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.challenge_id = $1 AND cm.status = 'accepted'
     ORDER BY checkin_count DESC`,
    [id]
  );

  // Gallery preview (6 most recent evidence photos)
  const { rows: gallery } = await query(
    `SELECT evidence_url, user_id, cycle_number
     FROM checkins
     WHERE challenge_id = $1 AND evidence_url IS NOT NULL
     ORDER BY checked_in_at DESC
     LIMIT 6`,
    [id]
  );

  // Check if already recreated
  const { rows: childCheck } = await query(
    `SELECT id FROM challenges WHERE parent_challenge_id = $1 LIMIT 1`,
    [id]
  );

  // Recreate eligible: within 90 days and not already recreated
  const endedAt = challenge.ended_at ? new Date(challenge.ended_at) : null;
  const daysSinceEnd = endedAt ? (Date.now() - endedAt.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
  const recreateEligible = daysSinceEnd <= RECREATE_WINDOW_DAYS && childCheck.length === 0;

  return NextResponse.json({
    challenge,
    result_banner: getResultBanner(challenge.status, challenge.end_reason),
    final_stats: challenge.final_stats || null,
    previous_squadmates: members,
    gallery_preview: gallery,
    recreate_eligible: recreateEligible,
    has_child_challenge: childCheck.length > 0,
  });
}
