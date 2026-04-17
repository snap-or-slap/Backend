import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Category mapping: notification_type → category
const CATEGORY_MAP: Record<string, string> = {
	friend_request: 'social',
	friend_accepted: 'social',
	challenge_invite: 'challenge',
	challenge_start: 'challenge',
	heart_lost: 'challenge',
	nudge: 'challenge',
	badge_earned: 'system',
};

const CATEGORY_TYPES: Record<string, string[]> = {
	social: ['friend_request', 'friend_accepted'],
	challenge: ['challenge_invite', 'challenge_start', 'heart_lost', 'nudge'],
	system: ['badge_earned'],
};

interface NotificationRow {
	id: string;
	type: string;
	metadata: Record<string, unknown>;
	is_read: boolean;
	created_at: string;
}

function formatNotification(row: NotificationRow) {
	const category = CATEGORY_MAP[row.type] || 'system';
	return {
		id: row.id,
		type: row.type,
		category,
		metadata: row.metadata,
		is_read: row.is_read,
		created_at: row.created_at,
	};
}

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
	const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
	const offset = (page - 1) * limit;
	const isReadParam = searchParams.get('is_read');
	const category = searchParams.get('category');

	let whereClause = 'WHERE user_id = $1';
	const params: unknown[] = [userId];
	let paramIdx = 1;

	// Filter by is_read
	if (isReadParam !== null) {
		paramIdx++;
		whereClause += ` AND is_read = $${paramIdx}`;
		params.push(isReadParam === 'true');
	}

	// Filter by category → convert to type IN (...)
	if (category && CATEGORY_TYPES[category]) {
		const types = CATEGORY_TYPES[category];
		const placeholders = types.map((_, i) => `$${paramIdx + i + 1}`).join(', ');
		whereClause += ` AND type IN (${placeholders})`;
		params.push(...types);
		paramIdx += types.length;
	}

	// Total count
	const { rows: countRows } = await query(
		`SELECT COUNT(*)::int AS count FROM notifications ${whereClause}`,
		params,
	);
	const total = countRows[0]?.count ?? 0;

	// Unread count (always for user, ignoring other filters)
	const { rows: unreadRows } = await query(
		`SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
		[userId],
	);
	const unreadCount = unreadRows[0]?.count ?? 0;

	// Fetch notifications
	const { rows } = await query(
		`SELECT id, type, metadata, is_read, created_at
		 FROM notifications
		 ${whereClause}
		 ORDER BY created_at DESC
		 LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}`,
		[...params, limit, offset],
	);

	return NextResponse.json({
		notifications: (rows as NotificationRow[]).map(formatNotification),
		unread_count: unreadCount,
		total,
		page,
		limit,
		total_pages: Math.ceil(total / limit),
	});
}
