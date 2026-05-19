import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createChallengeSchema } from '@/lib/schemas/challenge';
import { transitionDueFormationChallenges } from '@/lib/services/cronService';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
  }

  const status = searchParams.get('status'); // optional filter: formation, active, completed, failed, cancelled
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  await transitionDueFormationChallenges();

  let whereClause = `WHERE cm.user_id = $1 AND cm.status = 'accepted'`;
  const params: unknown[] = [userId];

  if (status) {
    params.push(status);
    whereClause += ` AND c.status = $${params.length}`;
  }

  const { rows: challenges } = await query(
    `SELECT c.id, c.title, c.description, c.cover_url, c.duration_days,
		        c.frequency, c.reset_time, c.total_hearts, c.hearts_left,
		        c.max_members, c.is_private, c.status, c.start_at,
		        c.current_step, c.created_at,
		        cm.role AS my_role,
		        (SELECT COUNT(*)::int FROM challenge_members WHERE challenge_id = c.id AND status = 'accepted') AS member_count,
		        u.username AS creator_username, u.display_name AS creator_display_name
		 FROM challenges c
		 JOIN challenge_members cm ON cm.challenge_id = c.id
		 JOIN users u ON u.id = c.creator_id
		 ${whereClause}
		 ORDER BY c.created_at DESC
		 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count
		 FROM challenges c
		 JOIN challenge_members cm ON cm.challenge_id = c.id
		 ${whereClause}`,
    params
  );

  return NextResponse.json({
    challenges,
    total: parseInt(countRows[0].count, 10),
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
  }

  // Verify user exists
  const { rows: users } = await query(`SELECT id FROM users WHERE id = $1 AND is_active = true`, [userId]);
  if (users.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createChallengeSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  const { title, description, durationDays, frequency, frequencyDays, resetTime, totalHearts, maxMembers, isPrivate, invitedUserIds, startAt, coverUrl } = parsed.data;

  // If invitedUserIds provided, validate they are all friends
  if (invitedUserIds && invitedUserIds.length > 0) {
    const { rows: friends } = await query(
      `SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS friend_id
       FROM friend_requests
       WHERE status = 'accepted' AND (sender_id = $1 OR receiver_id = $1)`,
      [userId]
    );
    const friendIds = new Set(friends.map((f) => f.friend_id as string));
    const nonFriends = invitedUserIds.filter(id => !friendIds.has(id));
    if (nonFriends.length > 0) {
      return NextResponse.json({ error: 'Can only invite friends', nonFriendIds: nonFriends }, { status: 400 });
    }
  }

  // Create challenge
  const { rows: [challenge] } = await query(
    `INSERT INTO challenges (title, description, cover_url, creator_id, duration_days, frequency, frequency_days, start_at, reset_time, total_hearts, hearts_left, max_members, is_private, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12, 'formation')
		 RETURNING *`,
    [title, description || null, coverUrl || null, userId, durationDays, frequency, frequencyDays ? JSON.stringify(frequencyDays) : null, startAt || null, resetTime + ':00', totalHearts, maxMembers, isPrivate]
  );

  // Add creator as host member
  await query(
    `INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, joined_at)
		 VALUES ($1, $2, 'host', 'accepted', true, NOW())`,
    [challenge.id, userId]
  );

  // Invite users if provided
  if (invitedUserIds && invitedUserIds.length > 0) {
    const memberValues = invitedUserIds.map((_, i) => `($1, $${i + 2}, 'member', 'invited', false)`).join(', ');
    await query(
      `INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready) VALUES ${memberValues}`,
      [challenge.id, ...invitedUserIds]
    );

    // Create notifications for invited users
    const notifValues = invitedUserIds.map((_, i) => `($${i + 1}, 'challenge_invite', $${invitedUserIds.length + 1})`).join(', ');
    await query(
      `INSERT INTO notifications (user_id, type, metadata) VALUES ${notifValues}`,
      [
        ...invitedUserIds,
        JSON.stringify({
          challenge_id: challenge.id,
          challengeId: challenge.id,
          challenge_title: title,
          challengeTitle: title,
          inviter_id: userId,
          inviterId: userId,
          invited_by: userId,
        }),
      ]
    );
  }

  return NextResponse.json({ challenge }, { status: 201 });
}
