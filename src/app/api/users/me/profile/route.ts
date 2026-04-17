import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserStats } from '@/lib/services/userStatsService';
import { getUserBadges, getLockedBadges } from '@/lib/services/badgeService';

export async function GET(req: NextRequest) {
	const userId = new URL(req.url).searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	// Get user
	const { rows } = await query(
		`SELECT id, email, username, display_name, avatar_url, bio, is_private, is_active, created_at
		 FROM users WHERE id = $1`,
		[userId]
	);
	if (rows.length === 0) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	// Get stats
	const stats = await getUserStats(userId);

	// Get badges
	const badges = await getUserBadges(userId);
	const badgesLocked = await getLockedBadges(userId);

	// Get recent activities (last 10)
	const { rows: activities } = await query(
		`SELECT id, type, metadata, created_at
		 FROM activities WHERE user_id = $1
		 ORDER BY created_at DESC LIMIT 10`,
		[userId]
	);

	return NextResponse.json({
		user: rows[0],
		stats,
		badges,
		badges_locked: badgesLocked,
		recent_activities: activities,
	});
}
