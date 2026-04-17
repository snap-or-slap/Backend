import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { inviteSchema } from '@/lib/schemas/challenge';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
  }

  // Verify user is host of this formation challenge
  const { rows: challenges } = await query(
    `SELECT c.id, c.status, c.max_members
     FROM challenges c
     JOIN challenge_members cm ON cm.challenge_id = c.id
     WHERE c.id = $1 AND cm.user_id = $2 AND cm.role = 'host'`,
    [id, userId]
  );

  if (challenges.length === 0) {
    return NextResponse.json({ error: 'Challenge not found or you are not the host' }, { status: 403 });
  }

  const challenge = challenges[0];
  if (challenge.status !== 'formation') {
    return NextResponse.json({ error: 'Challenge already started' }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  const { userIds } = parsed.data;

  // Check slot availability
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count FROM challenge_members WHERE challenge_id = $1 AND status != 'declined'`,
    [id]
  );
  const currentCount = parseInt(countRows[0].count, 10);
  if (currentCount + userIds.length > challenge.max_members) {
    return NextResponse.json({ error: 'No more slots available' }, { status: 409 });
  }

  // Verify all invitees are friends
  const { rows: friends } = await query(
    `SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS friend_id
     FROM friend_requests
     WHERE status = 'accepted' AND (sender_id = $1 OR receiver_id = $1)`,
    [userId]
  );
  const friendIds = new Set(friends.map((f) => f.friend_id as string));
  const nonFriends = userIds.filter(uid => !friendIds.has(uid));
  if (nonFriends.length > 0) {
    return NextResponse.json({ error: 'Can only invite friends', nonFriendIds: nonFriends }, { status: 400 });
  }

  // Check which users are already members
  const { rows: existingMembers } = await query(
    `SELECT user_id FROM challenge_members WHERE challenge_id = $1 AND user_id = ANY($2)`,
    [id, userIds]
  );
  const existingIds = new Set(existingMembers.map((m) => m.user_id as string));
  const newUserIds = userIds.filter(uid => !existingIds.has(uid));

  if (newUserIds.length === 0) {
    return NextResponse.json({ error: 'All users are already members' }, { status: 409 });
  }

  // Insert new members
  const memberValues = newUserIds.map((_, i) => `($1, $${i + 2}, 'member', 'invited', false)`).join(', ');
  const { rows: invited } = await query(
    `INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready)
     VALUES ${memberValues}
     RETURNING id, user_id, role, status`,
    [id, ...newUserIds]
  );

  // Create notifications
  const notifValues = newUserIds.map((_, i) => `($${i + 1}, 'challenge_invite', $${newUserIds.length + 1})`).join(', ');
  await query(
    `INSERT INTO notifications (user_id, type, metadata) VALUES ${notifValues}`,
    [...newUserIds, JSON.stringify({ challenge_id: id, invited_by: userId })]
  );

  return NextResponse.json({ invited, skipped: [...existingIds] }, { status: 201 });
}
