import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createCompletionSnapshot } from '@/lib/services/cronService';

// GET — browser-testable: view challenge cancel/status info
export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	const { rows } = await query(
		`SELECT id, title, status, end_reason, final_stats, updated_at
		 FROM challenges WHERE id = $1`,
		[id]
	);

	if (rows.length === 0) {
		return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
	}

	const ch = rows[0];
	return NextResponse.json({
		challenge_id: ch.id,
		title: ch.title,
		status: ch.status,
		end_reason: ch.end_reason,
		final_stats: ch.final_stats,
		updated_at: ch.updated_at,
		can_cancel: ch.status === 'active',
	});
}

// POST — cancel active challenge (host only)
export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const { searchParams } = new URL(req.url);
	const userId = searchParams.get('user_id');

	if (!userId) {
		return NextResponse.json({ error: 'user_id query param required' }, { status: 400 });
	}

	// Verify challenge exists and user is host
	const { rows } = await query(
		`SELECT c.id, c.status, c.creator_id, c.title, c.start_at, c.duration_days,
		        c.current_step, c.hearts_left, c.total_hearts
		 FROM challenges c
		 WHERE c.id = $1 AND c.creator_id = $2`,
		[id, userId]
	);

	if (rows.length === 0) {
		return NextResponse.json({ error: 'Challenge not found or you are not the host' }, { status: 403 });
	}

	const challenge = rows[0];

	if (challenge.status !== 'active') {
		return NextResponse.json(
			{ error: `Cannot cancel challenge with status '${challenge.status}'. Only active challenges can be cancelled.` },
			{ status: 409 }
		);
	}

	// Cancel the challenge
	await query(
		`UPDATE challenges SET status = 'cancelled', end_reason = 'host_cancelled', updated_at = NOW() WHERE id = $1`,
		[id]
	);

	// Create completion snapshot
	const actualSteps = challenge.current_step as number;
	const finalStats = await createCompletionSnapshot(id, 'cancelled', actualSteps);

	// Notify all accepted members
	const { rows: members } = await query(
		`SELECT user_id FROM challenge_members WHERE challenge_id = $1 AND status = 'accepted'`,
		[id]
	);
	for (const m of members) {
		await query(
			`INSERT INTO notifications (user_id, type, metadata)
			 VALUES ($1, 'challenge_start', $2)`,
			[m.user_id, JSON.stringify({
				challenge_id: id,
				title: challenge.title,
				cancelled: true,
				reason: 'Host cancelled the challenge',
			})]
		);
	}

	return NextResponse.json({
		challenge_id: id,
		status: 'cancelled',
		end_reason: 'host_cancelled',
		final_stats: finalStats,
	});
}
