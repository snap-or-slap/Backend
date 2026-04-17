import { query } from '@/lib/db';

/**
 * Calculate current streak for a user.
 * Streak = consecutive days (from today/yesterday backwards) with at least 1 checkin.
 */
export async function calculateStreak(userId: string): Promise<number> {
	const { rows } = await query<{ checkin_date: string }>(
		`SELECT DISTINCT DATE(checked_in_at) AS checkin_date
		 FROM checkins
		 WHERE user_id = $1
		 ORDER BY checkin_date DESC`,
		[userId]
	);

	if (rows.length === 0) return 0;

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const firstDate = new Date(rows[0].checkin_date);
	firstDate.setHours(0, 0, 0, 0);

	const diffDays = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

	// If the most recent checkin is older than yesterday, streak is 0
	if (diffDays > 1) return 0;

	let streak = 1;
	for (let i = 1; i < rows.length; i++) {
		const prev = new Date(rows[i - 1].checkin_date);
		const curr = new Date(rows[i].checkin_date);
		prev.setHours(0, 0, 0, 0);
		curr.setHours(0, 0, 0, 0);

		const gap = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
		if (gap === 1) {
			streak++;
		} else {
			break;
		}
	}

	return streak;
}
