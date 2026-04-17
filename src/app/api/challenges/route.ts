import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createChallengeSchema } from '@/lib/schemas/challenge';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	const status = searchParams.get('status'); // optional filter: formation, active, completed, failed, cancelled
	const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
	const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
	const offset = (page - 1) * limit;

	let whereClause = `WHERE cm.user_id = $1 AND cm.status = 'accepted'`;
	const params: unknown[] = [userId];

	if (status) {
		params.push(status);
		whereClause += ` AND c.status = $${params.length}`;
	}

	const { rows: challenges } = await query(
		`SELECT c.id, c.title, c.description, c.cover_url, c.duration_days,
		        c.frequency, c.reset_time, c.total_hearts, c.hearts_left,
		        c.max_members, c.is_private, c.status, c.start_at,
		        c.current_step, c.created_at,
		        cm.role AS my_role,
		        (SELECT COUNT(*)::int FROM challenge_members WHERE challenge_id = c.id AND status = 'accepted') AS member_count,
		        u.username AS creator_username, u.display_name AS creator_display_name
		 FROM challenges c
		 JOIN challenge_members cm ON cm.challenge_id = c.id
		 JOIN users u ON u.id = c.creator_id
		 ${whereClause}
		 ORDER BY c.created_at DESC
		 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
		[...params, limit, offset]
	);

	const { rows: countRows } = await query(
		`SELECT COUNT(*)::int AS count
		 FROM challenges c
		 JOIN challenge_members cm ON cm.challenge_id = c.id
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

export async function POST(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	// Verify user exists
	const { rows: users } = await query(`SELECT id FROM users WHERE id = $1 AND is_active = true`, [userId]);
	if (users.length === 0) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = createChallengeSchema.safeParse(body);
	if (!parsed.success) {
		const errors = parsed.error.issues.map((i) => ({
			field: i.path.join('.'),
			message: i.message,
		}));
		return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
	}

	const { title, description, durationDays, frequency, frequencyDays, resetTime, totalHearts, maxMembers, isPrivate } = parsed.data;

	// Create challenge
	const { rows: [challenge] } = await query(
		`INSERT INTO challenges (title, description, creator_id, duration_days, frequency, frequency_days, reset_time, total_hearts, hearts_left, max_members, is_private, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, 'formation')
		 RETURNING *`,
		[title, description || null, userId, durationDays, frequency, frequencyDays ? JSON.stringify(frequencyDays) : null, resetTime + ':00', totalHearts, maxMembers, isPrivate]
	);

	// Add creator as host member
	await query(
		`INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, joined_at)
		 VALUES ($1, $2, 'host', 'accepted', true, NOW())`,
		[challenge.id, userId]
	);

	return NextResponse.json({ challenge }, { status: 201 });
}
