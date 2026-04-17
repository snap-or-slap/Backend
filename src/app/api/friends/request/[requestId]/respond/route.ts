import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { respondFriendRequestSchema } from '@/lib/schemas/friend';

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ requestId: string }> }
) {
	const { requestId } = await params;
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

	const parsed = respondFriendRequestSchema.safeParse(body);
	if (!parsed.success) {
		const errors = parsed.error.issues.map((i) => ({
			field: i.path.join('.'),
			message: i.message,
		}));
		return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
	}

	const { action } = parsed.data;

	// Get friend request
	const { rows: requests } = await query(
		`SELECT id, sender_id, receiver_id, status FROM friend_requests WHERE id = $1`,
		[requestId]
	);

	if (requests.length === 0) {
		return NextResponse.json({ error: 'Friend request not found' }, { status: 404 });
	}

	const friendReq = requests[0];

	if (friendReq.receiver_id !== userId) {
		return NextResponse.json({ error: 'Not authorized to respond to this request' }, { status: 403 });
	}

	if (friendReq.status !== 'pending') {
		return NextResponse.json({ error: 'Request already processed' }, { status: 409 });
	}

	const newStatus = action === 'accept' ? 'accepted' : 'declined';
	const { rows: updated } = await query(
		`UPDATE friend_requests SET status = $1 WHERE id = $2 RETURNING id, sender_id, receiver_id, status`,
		[newStatus, requestId]
	);

	if (action === 'accept') {
		// Create activity for both users
		await query(
			`INSERT INTO activities (user_id, type, metadata) VALUES ($1, 'friend_added', $2)`,
			[friendReq.sender_id, JSON.stringify({ friend_id: userId })]
		);
		await query(
			`INSERT INTO activities (user_id, type, metadata) VALUES ($1, 'friend_added', $2)`,
			[userId, JSON.stringify({ friend_id: friendReq.sender_id })]
		);
		// Notify sender that request was accepted
		await query(
			`INSERT INTO notifications (user_id, type, metadata) VALUES ($1, 'friend_accepted', $2)`,
			[friendReq.sender_id, JSON.stringify({ friend_id: userId })]
		);
	}

	return NextResponse.json({ request: updated[0] });
}
