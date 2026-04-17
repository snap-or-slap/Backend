import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
  }

  // Check membership, role, and challenge status
  const { rows } = await query(
    `SELECT cm.id, cm.role, c.status AS challenge_status
     FROM challenge_members cm
     JOIN challenges c ON c.id = cm.challenge_id
     WHERE cm.challenge_id = $1 AND cm.user_id = $2 AND cm.status = 'accepted'`,
    [id, userId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not a member of this challenge' }, { status: 404 });
  }

  const membership = rows[0];

  if (membership.role === 'host') {
    return NextResponse.json({ error: 'Host cannot leave. Cancel the challenge instead.' }, { status: 400 });
  }

  if (membership.challenge_status !== 'formation') {
    return NextResponse.json({ error: 'Cannot leave an active challenge' }, { status: 400 });
  }

  // Remove member
  await query(
    `DELETE FROM challenge_members WHERE challenge_id = $1 AND user_id = $2`,
    [id, userId]
  );

  return NextResponse.json({ message: 'Left challenge successfully', challenge_id: id });
}
