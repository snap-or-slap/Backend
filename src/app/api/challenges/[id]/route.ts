import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { updateChallengeSchema } from '@/lib/schemas/challenge';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');

  const { rows } = await query(
    `SELECT c.*,
		        u.username AS creator_username, u.display_name AS creator_display_name,
		        (SELECT COUNT(*)::int FROM challenge_members WHERE challenge_id = c.id AND status = 'accepted') AS member_count
		 FROM challenges c
		 JOIN users u ON u.id = c.creator_id
		 WHERE c.id = $1`,
    [id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  }

  const challenge = rows[0];

  // Get members
  const { rows: members } = await query(
    `SELECT cm.user_id, cm.role, cm.status, cm.is_ready, cm.current_step, cm.joined_at,
		        u.username, u.display_name, u.avatar_url
		 FROM challenge_members cm
		 JOIN users u ON u.id = cm.user_id
		 WHERE cm.challenge_id = $1
		 ORDER BY cm.role ASC, cm.joined_at ASC`,
    [id]
  );

  // If user_id provided, get their membership info
  let myMembership = null;
  if (userId) {
    const member = members.find((m) => m.user_id === userId);
    if (member) {
      myMembership = { role: member.role, status: member.status, is_ready: member.is_ready, current_step: member.current_step };
    }
  }

  return NextResponse.json({ challenge, members, my_membership: myMembership });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
  }

  // Verify challenge exists and user is host
  const { rows: challenges } = await query(
    `SELECT c.id, c.status FROM challenges c
		 JOIN challenge_members cm ON cm.challenge_id = c.id
		 WHERE c.id = $1 AND cm.user_id = $2 AND cm.role = 'host'`,
    [id, userId]
  );
  if (challenges.length === 0) {
    return NextResponse.json({ error: 'Challenge not found or you are not the host' }, { status: 404 });
  }
  if (challenges[0].status !== 'formation') {
    return NextResponse.json({ error: 'Can only edit challenges in formation status' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateChallengeSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Build dynamic UPDATE
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.title !== undefined) { setClauses.push(`title = $${idx++}`); values.push(data.title); }
  if (data.description !== undefined) { setClauses.push(`description = $${idx++}`); values.push(data.description); }
  if (data.durationDays !== undefined) { setClauses.push(`duration_days = $${idx++}`); values.push(data.durationDays); }
  if (data.frequency !== undefined) { setClauses.push(`frequency = $${idx++}`); values.push(data.frequency); }
  if (data.frequencyDays !== undefined) { setClauses.push(`frequency_days = $${idx++}`); values.push(JSON.stringify(data.frequencyDays)); }
  if (data.resetTime !== undefined) { setClauses.push(`reset_time = $${idx++}`); values.push(data.resetTime + ':00'); }
  if (data.totalHearts !== undefined) {
    setClauses.push(`total_hearts = $${idx}`);
    setClauses.push(`hearts_left = $${idx++}`);
    values.push(data.totalHearts);
  }
  if (data.maxMembers !== undefined) { setClauses.push(`max_members = $${idx++}`); values.push(data.maxMembers); }
  if (data.isPrivate !== undefined) { setClauses.push(`is_private = $${idx++}`); values.push(data.isPrivate); }

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const { rows: [updated] } = await query(
    `UPDATE challenges SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  return NextResponse.json({ challenge: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
  }

  // Verify challenge exists and user is host
  const { rows: challenges } = await query(
    `SELECT c.id, c.status FROM challenges c
		 JOIN challenge_members cm ON cm.challenge_id = c.id
		 WHERE c.id = $1 AND cm.user_id = $2 AND cm.role = 'host'`,
    [id, userId]
  );
  if (challenges.length === 0) {
    return NextResponse.json({ error: 'Challenge not found or you are not the host' }, { status: 404 });
  }

  const challengeStatus = challenges[0].status;
  if (challengeStatus === 'active') {
    // Cancel active challenge instead of deleting
    await query(
      `UPDATE challenges SET status = 'cancelled', end_reason = 'host_cancelled', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    return NextResponse.json({ message: 'Active challenge cancelled', id });
  }

  if (challengeStatus === 'formation') {
    // Delete formation challenge completely
    await query(`DELETE FROM challenges WHERE id = $1`, [id]);
    return NextResponse.json({ message: 'Challenge deleted', id });
  }

  return NextResponse.json({ error: 'Cannot delete completed/failed/cancelled challenges' }, { status: 400 });
}
