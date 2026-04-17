import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
	const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
	const offset = (page - 1) * limit;

	// Get friends (accepted friend requests in both directions)
	const { rows: friends } = await query(
		`SELECT u.id, u.username, u.display_name, u.avatar_url,
		        COALESCE(cm_count.cnt, 0) AS active_challenges_count
		 FROM friend_requests fr
		 JOIN users u ON u.id = CASE WHEN fr.sender_id = $1 THEN fr.receiver_id ELSE fr.sender_id END
		 LEFT JOIN LATERAL (
		   SELECT COUNT(*)::int AS cnt
		   FROM challenge_members cm
		   JOIN challenges c ON c.id = cm.challenge_id
		   WHERE cm.user_id = u.id AND cm.status = 'accepted' AND c.status = 'active'
		 ) cm_count ON true
		 WHERE fr.status = 'accepted'
		   AND (fr.sender_id = $1 OR fr.receiver_id = $1)
		   AND u.is_active = true
		 ORDER BY u.display_name ASC NULLS LAST, u.username ASC
		 LIMIT $2 OFFSET $3`,
		[userId, limit, offset]
	);

	const { rows: countRows } = await query(
		`SELECT COUNT(*)::int AS count
		 FROM friend_requests fr
		 JOIN users u ON u.id = CASE WHEN fr.sender_id = $1 THEN fr.receiver_id ELSE fr.sender_id END
		 WHERE fr.status = 'accepted'
		   AND (fr.sender_id = $1 OR fr.receiver_id = $1)
		   AND u.is_active = true`,
		[userId]
	);

	return NextResponse.json({
		friends,
		total: parseInt(countRows[0].count, 10),
		page,
		limit,
	});
}
