import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const FINISHED_STATUSES = ['completed', 'failed', 'cancelled'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: oldId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id query parameter is required' }, { status: 400 });
  }

  // Fetch old challenge
  const { rows } = await query(
    `SELECT id, status, title, description, duration_days, frequency, frequency_days,
            reset_time, total_hearts, max_members, is_private, cover_url
     FROM challenges WHERE id = $1`,
    [oldId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  }

  const old = rows[0];

  if (!FINISHED_STATUSES.includes(old.status)) {
    return NextResponse.json(
      { error: 'Can only recreate finished challenges (completed, failed or cancelled)' },
      { status: 409 }
    );
  }

  // Check user was a member
  const { rows: memberCheck } = await query(
    `SELECT user_id, status FROM challenge_members WHERE challenge_id = $1 AND user_id = $2`,
    [oldId, userId]
  );

  if (memberCheck.length === 0) {
    return NextResponse.json({ error: 'You must be a member of the original challenge to recreate it' }, { status: 403 });
  }

  // Parse body
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const reinviteUserIds: string[] = Array.isArray(body.reinvite_user_ids) ? body.reinvite_user_ids : [];

  // If reinviting, validate all are friends
  if (reinviteUserIds.length > 0) {
    const { rows: friends } = await query(
      `SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS friend_id
       FROM friend_requests
       WHERE status = 'accepted'
         AND (sender_id = $1 OR receiver_id = $1)
         AND (sender_id = ANY($2::uuid[]) OR receiver_id = ANY($2::uuid[]))`,
      [userId, reinviteUserIds]
    );

    const friendIds = new Set(friends.map((f) => f.friend_id as string));
    const nonFriends = reinviteUserIds.filter(uid => !friendIds.has(uid));

    if (nonFriends.length > 0) {
      return NextResponse.json(
        { error: 'You can only invite friends. Non-friend user IDs: ' + nonFriends.join(', ') },
        { status: 400 }
      );
    }
  }

  // Merge old settings with overrides
  const title = (body.title as string) || old.title;
  const description = body.description !== undefined ? body.description : old.description;
  const durationDays = (body.duration_days as number) || old.duration_days;
  const frequency = (body.frequency as string) || old.frequency;
  const resetTime = (body.reset_time as string) || old.reset_time;
  const totalHearts = (body.total_hearts as number) || old.total_hearts;
  const maxMembers = (body.max_members as number) || old.max_members;
  const isPrivate = body.is_private !== undefined ? body.is_private : old.is_private;
  const coverUrl = body.cover_url !== undefined ? body.cover_url : old.cover_url;

  // Insert new challenge
  const { rows: newChallenge } = await query(
    `INSERT INTO challenges (title, description, duration_days, frequency, frequency_days, reset_time,
                             total_hearts, max_members, is_private, cover_url, creator_id,
                             parent_challenge_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'formation')
     RETURNING *`,
    [title, description, durationDays, frequency, old.frequency_days, resetTime,
     totalHearts, maxMembers, isPrivate, coverUrl, userId, oldId]
  );

  const challenge = newChallenge[0];

  // Add host as member
  await query(
    `INSERT INTO challenge_members (challenge_id, user_id, role, status)
     VALUES ($1, $2, 'host', 'accepted')`,
    [challenge.id, userId]
  );

  // Invite friends
  if (reinviteUserIds.length > 0) {
    const memberValues = reinviteUserIds.map((_, i) => `($1, $${i + 2}, 'member', 'invited')`).join(', ');
    await query(
      `INSERT INTO challenge_members (challenge_id, user_id, role, status) VALUES ${memberValues}`,
      [challenge.id, ...reinviteUserIds]
    );

    // Create notifications
    const notifValues = reinviteUserIds.map((_, i) => `($${i + 1}, 'challenge_invite', $${reinviteUserIds.length + 1})`).join(', ');
    await query(
      `INSERT INTO notifications (user_id, type, metadata) VALUES ${notifValues}`,
      [...reinviteUserIds, JSON.stringify({ challenge_id: challenge.id, inviter_id: userId })]
    );
  }

  return NextResponse.json({ challenge }, { status: 201 });
}
