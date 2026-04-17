import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	const { rows } = await query(
		`SELECT fr.id, fr.created_at,
		        u.id AS sender_id, u.username AS sender_username,
		        u.display_name AS sender_display_name, u.avatar_url AS sender_avatar_url
		 FROM friend_requests fr
		 JOIN users u ON u.id = fr.sender_id
		 WHERE fr.receiver_id = $1
		   AND fr.status = 'pending'
		   AND u.is_active = true
		 ORDER BY fr.created_at DESC`,
		[userId]
	);

	const requests = rows.map((r) => ({
		id: r.id,
		sender: {
			id: r.sender_id,
			username: r.sender_username,
			display_name: r.sender_display_name,
			avatar_url: r.sender_avatar_url,
		},
		created_at: r.created_at,
	}));

	return NextResponse.json({ requests });
}
