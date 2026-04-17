import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	// Current streak
	const { rows: statsRows } = await query(
		`SELECT current_streak FROM user_stats WHERE user_id = $1`,
		[userId],
	);
	const currentStreak = statsRows[0]?.current_streak ?? 0;

	// Active challenges with today's check-in status
	const { rows: activeChallenges } = await query(
		`SELECT
			c.id,
			c.title,
			c.hearts_left,
			c.total_hearts,
			c.reset_time,
			(SELECT COUNT(*)::int FROM challenge_members WHERE challenge_id = c.id AND status = 'accepted') AS member_count,
			EXISTS(
				SELECT 1 FROM checkins
				WHERE challenge_id = c.id
				  AND user_id = $1
				  AND checked_in_at::date = CURRENT_DATE
			) AS my_checkin_today,
			(SELECT COUNT(*)::int FROM checkins
			 WHERE challenge_id = c.id
			   AND checked_in_at::date = CURRENT_DATE
			) AS members_checked_in
		 FROM challenges c
		 JOIN challenge_members cm ON cm.challenge_id = c.id
		 WHERE cm.user_id = $1
		   AND cm.status = 'accepted'
		   AND c.status = 'active'
		 ORDER BY c.start_at DESC`,
		[userId],
	);

	// Unread notifications count
	const { rows: unreadRows } = await query(
		`SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
		[userId],
	);

	return NextResponse.json({
		current_streak: currentStreak,
		active_challenges: activeChallenges,
		unread_notifications: unreadRows[0]?.count ?? 0,
	});
}
