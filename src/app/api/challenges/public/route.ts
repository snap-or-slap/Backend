import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { transitionDueFormationChallenges } from '@/lib/services/cronService';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id'); // optional — exclude challenges user is already in
	const q = searchParams.get('q'); // optional search keyword
	const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
	const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
	const offset = (page - 1) * limit;

	// Lazy evaluation for formation challenges
	await transitionDueFormationChallenges();

	let whereClause = `WHERE c.status = 'formation' AND c.is_private = false`;
	const params: unknown[] = [];

	// Exclude full challenges
	whereClause += ` AND (SELECT COUNT(*)::int FROM challenge_members WHERE challenge_id = c.id AND status != 'declined') < c.max_members`;

	// Exclude challenges user is already a member of
	if (userId) {
		params.push(userId);
		whereClause += ` AND NOT EXISTS (SELECT 1 FROM challenge_members WHERE challenge_id = c.id AND user_id = $${params.length})`;
	}

	// Search by keyword
	if (q && q.trim().length > 0) {
		params.push(`%${q.trim()}%`);
		whereClause += ` AND (c.title ILIKE $${params.length} OR c.description ILIKE $${params.length})`;
	}

	const { rows: challenges } = await query(
		`SELECT c.id, c.title, c.description, c.cover_url, c.duration_days,
            c.frequency, c.reset_time, c.total_hearts, c.max_members,
            c.status, c.start_at, c.created_at,
            (SELECT COUNT(*)::int FROM challenge_members WHERE challenge_id = c.id AND status != 'declined') AS member_count,
            u.username AS creator_username, u.display_name AS creator_display_name, u.avatar_url AS creator_avatar_url
     FROM challenges c
     JOIN users u ON u.id = c.creator_id
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
		[...params, limit, offset]
	);

	const { rows: countRows } = await query(
		`SELECT COUNT(*)::int AS count
     FROM challenges c
     ${whereClause}`,
		params
	);

	return NextResponse.json({
		challenges,
		total: parseInt(countRows[0].count, 10),
		page,
		limit,
	});
}
