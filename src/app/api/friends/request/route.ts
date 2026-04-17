import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { friendRequestSchema } from '@/lib/schemas/friend';

export async function POST(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = friendRequestSchema.safeParse(body);
	if (!parsed.success) {
		const errors = parsed.error.issues.map((i) => ({
			field: i.path.join('.'),
			message: i.message,
		}));
		return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
	}

	const { receiver_id } = parsed.data;

	if (userId === receiver_id) {
		return NextResponse.json({ error: 'Cannot send friend request to yourself' }, { status: 400 });
	}

	// Check receiver exists
	const { rows: receivers } = await query(
		`SELECT id FROM users WHERE id = $1 AND is_active = true`,
		[receiver_id]
	);
	if (receivers.length === 0) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	// Check existing relationship (both directions)
	const { rows: existing } = await query(
		`SELECT id, sender_id, receiver_id, status FROM friend_requests
		 WHERE (sender_id = $1 AND receiver_id = $2)
		    OR (sender_id = $2 AND receiver_id = $1)`,
		[userId, receiver_id]
	);

	if (existing.length > 0) {
		const rel = existing[0];
		if (rel.status === 'accepted') {
			return NextResponse.json({ error: 'Already friends' }, { status: 409 });
		}
		if (rel.status === 'pending' && rel.sender_id === userId) {
			return NextResponse.json({ error: 'Request already sent' }, { status: 409 });
		}
		if (rel.status === 'pending' && rel.receiver_id === userId) {
			return NextResponse.json({ error: 'They already sent you a request. Check pending requests.' }, { status: 409 });
		}
		// If declined, allow re-sending — delete old record first
		if (rel.status === 'declined') {
			await query(`DELETE FROM friend_requests WHERE id = $1`, [rel.id]);
		}
	}

	// Create friend request
	const { rows } = await query(
		`INSERT INTO friend_requests (sender_id, receiver_id, status)
		 VALUES ($1, $2, 'pending')
		 RETURNING id, sender_id, receiver_id, status, created_at`,
		[userId, receiver_id]
	);

	// Create notification for receiver
	await query(
		`INSERT INTO notifications (user_id, type, metadata)
		 VALUES ($1, 'friend_request', $2)`,
		[receiver_id, JSON.stringify({ sender_id: userId })]
	);

	return NextResponse.json({ request: rows[0] }, { status: 201 });
}
