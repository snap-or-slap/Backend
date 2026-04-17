import { query } from '@/lib/db';

export interface Badge {
	id: string;
	name: string;
	slug: string;
	description: string;
	icon_url: string;
	condition_type: string;
	condition_value: number;
}

export interface UserBadge extends Badge {
	earned_at: string;
}

/**
 * Get all badges earned by a user.
 */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
	const { rows } = await query(
		`SELECT b.id, b.name, b.slug, b.description, b.icon_url, b.condition_type, b.condition_value, ub.earned_at
		 FROM user_badges ub
		 JOIN badges b ON b.id = ub.badge_id
		 WHERE ub.user_id = $1
		 ORDER BY ub.earned_at DESC`,
		[userId]
	);
	return rows as unknown as UserBadge[];
}

/**
 * Get all badges NOT yet earned by a user (locked badges).
 */
export async function getLockedBadges(userId: string): Promise<Badge[]> {
	const { rows } = await query(
		`SELECT b.id, b.name, b.slug, b.description, b.icon_url, b.condition_type, b.condition_value
		 FROM badges b
		 WHERE b.id NOT IN (SELECT badge_id FROM user_badges WHERE user_id = $1)
		 ORDER BY b.condition_type, b.condition_value`,
		[userId]
	);
	return rows as unknown as Badge[];
}

/**
 * Check conditions and auto-award eligible badges.
 * Returns list of newly awarded badge slugs.
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
	const awarded: string[] = [];

	// Get user stats
	const { rows: statsRows } = await query(
		`SELECT * FROM user_stats WHERE user_id = $1`,
		[userId]
	);
	if (statsRows.length === 0) return awarded;

	const stats = statsRows[0];

	// Get all badges not yet earned
	const { rows: unearned } = await query(
		`SELECT b.id, b.slug, b.name, b.condition_type, b.condition_value
		 FROM badges b
		 WHERE b.id NOT IN (SELECT badge_id FROM user_badges WHERE user_id = $1)`,
		[userId]
	);

	for (const badge of unearned) {
		let earned = false;

		switch (badge.condition_type as string) {
			case 'challenges_completed':
				earned = (stats.challenges_completed as number) >= (badge.condition_value as number);
				break;
			case 'streak_days':
				earned = Math.max(stats.current_streak as number, stats.best_streak as number) >= (badge.condition_value as number);
				break;
			case 'checkins_completed':
				earned = (stats.total_checkins as number) >= (badge.condition_value as number);
				break;
			case 'early_adopter':
				// Award to all existing users (condition_value=1 means just check)
				earned = true;
				break;
			case 'squad_mvp': {
				// Check if user has 100% completion rate in any completed challenge
				const { rows: mvpCheck } = await query(
					`SELECT 1 FROM challenge_members cm
					 JOIN challenges c ON c.id = cm.challenge_id
					 WHERE cm.user_id = $1
					   AND cm.status = 'accepted'
					   AND c.status = 'completed'
					   AND cm.current_step >= c.duration_days
					 LIMIT 1`,
					[userId]
				);
				earned = mvpCheck.length > 0;
				break;
			}
		}

		if (earned) {
			// Award badge
			await query(
				`INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				[userId, badge.id]
			);

			// Create activity
			await query(
				`INSERT INTO activities (user_id, type, metadata)
				 VALUES ($1, 'badge_earned', $2)`,
				[userId, JSON.stringify({ badge_id: badge.id, badge_name: badge.name, badge_slug: badge.slug })]
			);

			// Create notification
			await query(
				`INSERT INTO notifications (user_id, type, metadata)
				 VALUES ($1, 'badge_earned', $2)`,
				[userId, JSON.stringify({ badge_id: badge.id, badge_name: badge.name, badge_slug: badge.slug })]
			);

			awarded.push(badge.slug as string);
		}
	}

	return awarded;
}
