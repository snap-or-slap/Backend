import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	// Check user's membership
	const { rows } = await query(
		`SELECT cm.id, cm.status
     FROM challenge_members cm
     WHERE cm.challenge_id = $1 AND cm.user_id = $2 AND cm.status = 'invited'`,
		[id, userId]
	);

	if (rows.length === 0) {
		return NextResponse.json({ error: 'No pending invitation found' }, { status: 403 });
	}

	// Update status to declined
	const { rows: [updated] } = await query(
		`UPDATE challenge_members SET status = 'declined'
     WHERE challenge_id = $1 AND user_id = $2
     RETURNING *`,
		[id, userId]
	);

	return NextResponse.json({ member: updated });
}
