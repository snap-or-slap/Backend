import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { calculateStreak } from '@/lib/services/streakService';

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ userId: string }> }
) {
	const { userId: targetUserId } = await params;
	const { searchParams } = new URL(req.url);
	const currentUserId = searchParams.get('user_id');

	// Get target user
	const { rows: users } = await query(
		`SELECT id, username, display_name, avatar_url, bio, is_private, is_active
		 FROM users WHERE id = $1`,
		[targetUserId]
	);

	if (users.length === 0 || !users[0].is_active) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	const targetUser = users[0];

	// Self profile
	if (currentUserId === targetUserId) {
		const streak = await calculateStreak(targetUserId);
		const stats = await getUserStats(targetUserId, streak);
		const badges = await getUserBadges(targetUserId);
		const activities = await getUserActivities(targetUserId);

		return NextResponse.json({
			user: { id: targetUser.id, username: targetUser.username, display_name: targetUser.display_name, avatar_url: targetUser.avatar_url, bio: targetUser.bio },
			relationship: 'self',
			stats,
			badges,
			latest_activities: activities,
		});
	}

	// Check relationship
	let relationship: 'friend' | 'pending_sent' | 'pending_received' | 'squadmate' | 'none' = 'none';

	if (currentUserId) {
		const { rows: rels } = await query(
			`SELECT sender_id, receiver_id, status FROM friend_requests
			 WHERE (sender_id = $1 AND receiver_id = $2)
			    OR (sender_id = $2 AND receiver_id = $1)`,
			[currentUserId, targetUserId]
		);

		if (rels.length > 0) {
			const rel = rels[0];
			if (rel.status === 'accepted') {
				relationship = 'friend';
			} else if (rel.status === 'pending') {
				relationship = rel.sender_id === currentUserId ? 'pending_sent' : 'pending_received';
			}
		}

		// Check squadmate (share a challenge)
		if (relationship === 'none') {
			const { rows: shared } = await query(
				`SELECT cm.challenge_id FROM challenge_members cm
				 WHERE cm.user_id IN ($1, $2) AND cm.status = 'accepted'
				 GROUP BY cm.challenge_id
				 HAVING COUNT(DISTINCT cm.user_id) = 2
				 LIMIT 1`,
				[currentUserId, targetUserId]
			);
			if (shared.length > 0) {
				relationship = 'squadmate';
			}
		}
	}

	// Friend → full profile
	if (relationship === 'friend') {
		const streak = await calculateStreak(targetUserId);
		const stats = await getUserStats(targetUserId, streak);
		const badges = await getUserBadges(targetUserId);
		const activities = await getUserActivities(targetUserId);

		return NextResponse.json({
			user: { id: targetUser.id, username: targetUser.username, display_name: targetUser.display_name, avatar_url: targetUser.avatar_url, bio: targetUser.bio },
			relationship: 'friend',
			stats,
			badges,
			latest_activities: activities,
		});
	}

	// Squadmate → shared challenge info, no activities
	if (relationship === 'squadmate') {
		return NextResponse.json({
			user: { id: targetUser.id, username: targetUser.username, display_name: targetUser.display_name, avatar_url: targetUser.avatar_url },
			relationship: 'squadmate',
			stats: null,
			badges: null,
			latest_activities: null,
		});
	}

	// Stranger / pending → limited info
	if (targetUser.is_private) {
		return NextResponse.json({
			user: { id: targetUser.id, username: targetUser.username },
			relationship,
			is_private: true,
			stats: null,
			badges: null,
			latest_activities: null,
		});
	}

	return NextResponse.json({
		user: { id: targetUser.id, username: targetUser.username, display_name: targetUser.display_name, avatar_url: targetUser.avatar_url },
		relationship,
		is_stranger_warning: relationship === 'none',
		stats: null,
		badges: null,
		latest_activities: null,
	});
}

async function getUserStats(userId: string, streak: number) {
	const { rows: joinedRows } = await query(
		`SELECT COUNT(*)::int AS count FROM challenge_members
		 WHERE user_id = $1 AND status = 'accepted'`,
		[userId]
	);

	const { rows: rateRows } = await query(
		`SELECT
		   COUNT(DISTINCT c.id)::int AS total,
		   COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END)::int AS completed
		 FROM challenge_members cm
		 JOIN challenges c ON c.id = cm.challenge_id
		 WHERE cm.user_id = $1 AND cm.status = 'accepted'`,
		[userId]
	);

	const total = rateRows[0]?.total || 0;
	const completed = rateRows[0]?.completed || 0;

	return {
		current_streak: streak,
		challenges_joined: joinedRows[0]?.count || 0,
		completion_rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
	};
}

async function getUserBadges(userId: string) {
	const { rows } = await query(
		`SELECT b.id, b.name, b.icon_url
		 FROM user_badges ub
		 JOIN badges b ON b.id = ub.badge_id
		 WHERE ub.user_id = $1
		 ORDER BY ub.earned_at DESC`,
		[userId]
	);
	return rows;
}

async function getUserActivities(userId: string) {
	const { rows } = await query(
		`SELECT id, type, metadata, created_at
		 FROM activities
		 WHERE user_id = $1
		 ORDER BY created_at DESC
		 LIMIT 10`,
		[userId]
	);
	return rows;
}
