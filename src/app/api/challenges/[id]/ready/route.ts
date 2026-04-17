import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { readySchema } from '@/lib/schemas/challenge';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	// Check membership + challenge status
	const { rows } = await query(
		`SELECT cm.id, c.status AS challenge_status
     FROM challenge_members cm
     JOIN challenges c ON c.id = cm.challenge_id
     WHERE cm.challenge_id = $1 AND cm.user_id = $2 AND cm.status = 'accepted'`,
		[id, userId]
	);

	if (rows.length === 0) {
		return NextResponse.json({ error: 'Not an accepted member of this challenge' }, { status: 403 });
	}

	if (rows[0].challenge_status !== 'formation') {
		return NextResponse.json({ error: 'Challenge is not in formation' }, { status: 409 });
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = readySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
	}

	const { isReady } = parsed.data;

	// Update ready status
	const { rows: [updated] } = await query(
		`UPDATE challenge_members SET is_ready = $1
     WHERE challenge_id = $2 AND user_id = $3
     RETURNING *`,
		[isReady, id, userId]
	);

	// Get readiness count
	const { rows: [readiness] } = await query(
		`SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE is_ready = true)::int AS ready
     FROM challenge_members
     WHERE challenge_id = $1 AND status = 'accepted'`,
		[id]
	);

	return NextResponse.json({
		is_ready: updated.is_ready,
		readiness: {
			total: parseInt(readiness.total, 10),
			ready: parseInt(readiness.ready, 10),
			all_ready: parseInt(readiness.ready, 10) === parseInt(readiness.total, 10),
		},
	});
}

// GET handler for browser testing — view readiness status
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const { rows: members } = await query(
		`SELECT cm.user_id, cm.role, cm.status, cm.is_ready,
            u.username, u.display_name
     FROM challenge_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.challenge_id = $1 AND cm.status = 'accepted'
     ORDER BY cm.role ASC, cm.joined_at ASC`,
		[id]
	);

	const total = members.length;
	const ready = members.filter(m => m.is_ready).length;

	return NextResponse.json({
		challenge_id: id,
		members,
		readiness: { total, ready, all_ready: ready === total && total >= 2 },
	});
}
