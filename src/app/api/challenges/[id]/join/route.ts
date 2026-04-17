import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
  }

  // Check user's membership and challenge status in one query
  const { rows } = await query(
    `SELECT cm.id, cm.status, c.status AS challenge_status, c.creator_id, c.max_members
     FROM challenge_members cm
     JOIN challenges c ON c.id = cm.challenge_id
     WHERE cm.challenge_id = $1 AND cm.user_id = $2`,
    [id, userId]
  );

  if (rows.length === 0 || rows[0].status !== 'invited') {
    return NextResponse.json({ error: 'No pending invitation found' }, { status: 403 });
  }

  const membership = rows[0];

  if (membership.challenge_status !== 'formation') {
    return NextResponse.json({ error: 'Challenge is no longer in formation' }, { status: 409 });
  }

  // Check if max members reached
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count FROM challenge_members WHERE challenge_id = $1 AND status = 'accepted'`,
    [id]
  );
  if (parseInt(countRows[0].count, 10) >= membership.max_members) {
    return NextResponse.json({ error: 'Challenge is full' }, { status: 409 });
  }

  // Accept invitation
  const { rows: [updated] } = await query(
    `UPDATE challenge_members SET status = 'accepted', is_ready = false, joined_at = NOW()
     WHERE challenge_id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId]
  );

  // Notify host
  await query(
    `INSERT INTO notifications (user_id, type, metadata)
     VALUES ($1, 'challenge_invite', $2)`,
    [membership.creator_id, JSON.stringify({ challenge_id: id, action: 'accepted', user_id: userId })]
  );

  return NextResponse.json({ member: updated });
}

// GET handler for browser testing — show invitation status
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');

  const { rows } = await query(
    `SELECT cm.user_id, cm.role, cm.status, cm.is_ready, cm.joined_at,
            u.username, u.display_name,
            c.title AS challenge_title, c.status AS challenge_status
     FROM challenge_members cm
     JOIN users u ON u.id = cm.user_id
     JOIN challenges c ON c.id = cm.challenge_id
     WHERE cm.challenge_id = $1 AND cm.status = 'invited'`,
    [id]
  );

  return NextResponse.json({
    challenge_id: id,
    pending_invitations: rows,
    count: rows.length,
    ...(userId ? { my_status: rows.find(r => r.user_id === userId)?.status || 'not_invited' } : {}),
  });
}
