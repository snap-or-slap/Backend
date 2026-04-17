import { query } from '@/lib/db';
import { calculateStreak } from './streakService';

export interface UserStats {
	user_id: string;
	challenges_joined: number;
	challenges_completed: number;
	total_checkins: number;
	current_streak: number;
	best_streak: number;
	updated_at: string;
}

/**
 * Recalculate and upsert user stats from source data.
 */
export async function recalculateUserStats(userId: string): Promise<UserStats> {
	// Count challenges joined (accepted members)
	const { rows: [joinedRow] } = await query(
		`SELECT COUNT(*)::int AS count FROM challenge_members WHERE user_id = $1 AND status = 'accepted'`,
		[userId]
	);

	// Count challenges completed
	const { rows: [completedRow] } = await query(
		`SELECT COUNT(*)::int AS count
		 FROM challenge_members cm
		 JOIN challenges c ON c.id = cm.challenge_id
		 WHERE cm.user_id = $1 AND cm.status = 'accepted' AND c.status = 'completed'`,
		[userId]
	);

	// Count total checkins
	const { rows: [checkinRow] } = await query(
		`SELECT COUNT(*)::int AS count FROM checkins WHERE user_id = $1`,
		[userId]
	);

	// Calculate current streak
	const currentStreak = await calculateStreak(userId);

	// Get existing best streak
	const { rows: existingStats } = await query(
		`SELECT best_streak FROM user_stats WHERE user_id = $1`,
		[userId]
	);
	const previousBest = existingStats.length > 0 ? (existingStats[0].best_streak as number) : 0;
	const bestStreak = Math.max(currentStreak, previousBest);

	// Upsert user_stats
	const { rows: [stats] } = await query(
		`INSERT INTO user_stats (user_id, challenges_joined, challenges_completed, total_checkins, current_streak, best_streak, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
		   challenges_joined = EXCLUDED.challenges_joined,
		   challenges_completed = EXCLUDED.challenges_completed,
		   total_checkins = EXCLUDED.total_checkins,
		   current_streak = EXCLUDED.current_streak,
		   best_streak = EXCLUDED.best_streak,
		   updated_at = NOW()
		 RETURNING *`,
		[userId, joinedRow.count, completedRow.count, checkinRow.count, currentStreak, bestStreak]
	);

	return stats as unknown as UserStats;
}

/**
 * Get user stats (read-only, no recalculation).
 * Returns defaults if no stats row exists.
 */
export async function getUserStats(userId: string): Promise<UserStats> {
	const { rows } = await query(
		`SELECT * FROM user_stats WHERE user_id = $1`,
		[userId]
	);

	if (rows.length === 0) {
		return {
			user_id: userId,
			challenges_joined: 0,
			challenges_completed: 0,
			total_checkins: 0,
			current_streak: 0,
			best_streak: 0,
			updated_at: new Date().toISOString(),
		};
	}

	return rows[0] as unknown as UserStats;
}
