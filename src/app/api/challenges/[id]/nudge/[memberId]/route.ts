import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentCycle } from '@/lib/services/checkinService';

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
	return Boolean(value && UUID_REGEX.test(value));
}

// POST — Send a nudge/slap notification to a member who has not checked in
export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string; memberId: string }> },
) {
	const { id, memberId } = await params;
	const userId = new URL(req.url).searchParams.get('user_id');

	if (!isUuid(id)) {
		return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 });
	}

	if (!isUuid(memberId)) {
		return NextResponse.json({ error: 'Invalid member id' }, { status: 400 });
	}

	if (!isUuid(userId)) {
		return NextResponse.json(
			{ error: 'user_id query param is required' },
			{ status: 400 },
		);
	}

	const { rows: challenges } = await query(
		`SELECT id, title, status, start_at, current_step
		 FROM challenges
		 WHERE id = $1::uuid`,
		[id],
	);

	if (challenges.length === 0) {
		return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
	}

	const challenge = challenges[0];

	if (challenge.status !== 'active') {
		return NextResponse.json({ error: 'Challenge is not active' }, { status: 409 });
	}

	const { rows: senderRows } = await query(
		`SELECT id, user_id, status
		 FROM challenge_members
		 WHERE challenge_id = $1::uuid
		   AND user_id = $2::uuid`,
		[id, userId],
	);

	if (senderRows.length === 0 || senderRows[0].status !== 'accepted') {
		return NextResponse.json(
			{ error: 'Sender must be an accepted member' },
			{ status: 403 },
		);
	}

	/**
	 * memberId is accepted as either:
	 * - challenge_members.id
	 * - challenge_members.user_id
	 *
	 * This avoids frontend ambiguity.
	 */
	const { rows: targetRows } = await query(
		`SELECT id, user_id, status
		 FROM challenge_members
		 WHERE challenge_id = $1::uuid
		   AND (id = $2::uuid OR user_id = $2::uuid)`,
		[id, memberId],
	);

	if (targetRows.length === 0 || targetRows[0].status !== 'accepted') {
		return NextResponse.json(
			{ error: 'Target must be an accepted member' },
			{ status: 403 },
		);
	}

	const target = targetRows[0];

	if (target.user_id === userId) {
		return NextResponse.json({ error: 'Cannot nudge yourself' }, { status: 400 });
	}

	const cycleNumber = getCurrentCycle(challenge.start_at);

	const { rows: targetCheckin } = await query(
		`SELECT id
		 FROM checkins
		 WHERE challenge_id = $1::uuid
		   AND user_id = $2::uuid
		   AND cycle_number = $3::int`,
		[id, target.user_id, cycleNumber],
	);

	if (targetCheckin.length > 0) {
		return NextResponse.json(
			{ error: 'Member has already checked in for this cycle' },
			{ status: 400 },
		);
	}

	// Rate limit: 1 nudge per sender/target/challenge/cycle.
	const { rows: recentNudge } = await query(
		`SELECT id
		 FROM notifications
		 WHERE user_id = $1::uuid
		   AND type = 'nudge'
		   AND metadata->>'from_user_id' = $2::text
		   AND metadata->>'challenge_id' = $3::text
		   AND metadata->>'cycle_number' = $4::text
		 LIMIT 1`,
		[target.user_id, userId, id, String(cycleNumber)],
	);

	if (recentNudge.length > 0) {
		return NextResponse.json(
			{ error: 'Already nudged this member today' },
			{ status: 429 },
		);
	}

	await query(
		`INSERT INTO notifications (user_id, type, metadata)
		 VALUES ($1::uuid, 'nudge', $2::jsonb)`,
		[
			target.user_id,
			JSON.stringify({
				from_user_id: userId,
				senderId: userId,

				challenge_id: id,
				challengeId: id,

				challenge_title: challenge.title,
				challengeTitle: challenge.title,

				target_user_id: target.user_id,
				targetUserId: target.user_id,

				target_member_id: target.id,
				targetMemberId: target.id,

				cycle_number: cycleNumber,
				cycleNumber,

				current_step: challenge.current_step,
				currentStep: challenge.current_step,

				action: 'slap_reminder',
			}),
		],
	);

	return NextResponse.json({
		message: 'Nudge sent successfully',
		target_user_id: target.user_id,
	});
}

// GET — View recent nudges for a member in this challenge
export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string; memberId: string }> },
) {
	const { id, memberId } = await params;

	if (!isUuid(id)) {
		return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 });
	}

	if (!isUuid(memberId)) {
		return NextResponse.json({ error: 'Invalid member id' }, { status: 400 });
	}

	const { rows: targetRows } = await query(
		`SELECT id, user_id
		 FROM challenge_members
		 WHERE challenge_id = $1::uuid
		   AND (id = $2::uuid OR user_id = $2::uuid)`,
		[id, memberId],
	);

	if (targetRows.length === 0) {
		return NextResponse.json({ error: 'Target member not found' }, { status: 404 });
	}

	const target = targetRows[0];

	const { rows: nudges } = await query(
		`SELECT n.id, n.metadata, n.created_at, n.is_read
		 FROM notifications n
		 WHERE n.user_id = $1::uuid
		   AND n.type = 'nudge'
		   AND n.metadata->>'challenge_id' = $2::text
		 ORDER BY n.created_at DESC
		 LIMIT 10`,
		[target.user_id, id],
	);

	return NextResponse.json({
		nudges,
		member_id: target.id,
		target_user_id: target.user_id,
		challenge_id: id,
	});
}