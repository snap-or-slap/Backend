import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ friendUserId: string }> }
) {
	const { friendUserId } = await params;
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	const result = await query(
		`DELETE FROM friend_requests
		 WHERE status = 'accepted'
		   AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))`,
		[userId, friendUserId]
	);

	if (result.rowCount === 0) {
		return NextResponse.json({ error: 'Not friends with this user' }, { status: 404 });
	}

	return NextResponse.json({ message: 'Unfriended successfully' });
}
