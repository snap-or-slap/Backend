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
	const type = searchParams.get('type');
	const offset = (page - 1) * limit;

	// Build WHERE clause
	const conditions = ['user_id = $1'];
	const params: unknown[] = [userId];
	let paramIdx = 2;

	if (type) {
		conditions.push(`type = $${paramIdx++}`);
		params.push(type);
	}

	const whereClause = conditions.join(' AND ');

	// Get total count
	const { rows: [countRow] } = await query(
		`SELECT COUNT(*)::int AS count FROM activities WHERE ${whereClause}`,
		params
	);

	// Get activities
	const { rows: activities } = await query(
		`SELECT id, type, metadata, created_at
		 FROM activities WHERE ${whereClause}
		 ORDER BY created_at DESC
		 LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
		[...params, limit, offset]
	);

	const total = countRow.count as number;

	return NextResponse.json({
		activities,
		pagination: {
			page,
			limit,
			total,
			total_pages: Math.ceil(total / limit),
		},
	});
}
