import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createCheckinSchema } from '@/lib/schemas/checkin';
import { getCurrentCycle } from '@/lib/services/checkinService';

// POST — Submit a check-in for the current cycle
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const userId = new URL(req.url).searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	let body: unknown;
	try { body = await req.json(); } catch { body = {}; }
	const parsed = createCheckinSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
	}

	// Check membership + challenge info
	const { rows: membership } = await query(
		`SELECT cm.status, c.status AS challenge_status, c.start_at, c.duration_days, c.reset_time, c.hearts_left
		 FROM challenge_members cm
		 JOIN challenges c ON c.id = cm.challenge_id
		 WHERE cm.challenge_id = $1 AND cm.user_id = $2`,
		[id, userId]
	);

	if (membership.length === 0 || membership[0].status !== 'accepted') {
		return NextResponse.json({ error: 'Not an accepted member of this challenge' }, { status: 403 });
	}

	if (membership[0].challenge_status !== 'active') {
		return NextResponse.json({ error: 'Challenge is not active' }, { status: 409 });
	}

	const cycleNumber = getCurrentCycle(membership[0].start_at);

	if (cycleNumber < 1) {
		return NextResponse.json({ error: 'Challenge has not started yet' }, { status: 400 });
	}
	if (cycleNumber > membership[0].duration_days) {
		return NextResponse.json({ error: 'Challenge has ended' }, { status: 400 });
	}

	// Check duplicate checkin for this cycle
	const { rows: existing } = await query(
		`SELECT id FROM checkins WHERE challenge_id = $1 AND user_id = $2 AND cycle_number = $3`,
		[id, userId, cycleNumber]
	);
	if (existing.length > 0) {
		return NextResponse.json({ error: 'Already checked in for this cycle' }, { status: 409 });
	}

	// Insert checkin
	const { rows: [checkin] } = await query(
		`INSERT INTO checkins (challenge_id, user_id, cycle_number, evidence_url, caption)
		 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
		[id, userId, cycleNumber, parsed.data.evidenceUrl || null, parsed.data.caption || null]
	);

	// Squad status for current cycle
	const { rows: [squadStatus] } = await query(
		`SELECT
		   COUNT(*) FILTER (WHERE ci.id IS NOT NULL)::int AS members_checked_in,
		   COUNT(*)::int AS members_total
		 FROM challenge_members cm
		 LEFT JOIN checkins ci ON ci.challenge_id = cm.challenge_id AND ci.user_id = cm.user_id AND ci.cycle_number = $2
		 WHERE cm.challenge_id = $1 AND cm.status = 'accepted'`,
		[id, cycleNumber]
	);

	// Total checkins for this user
	const { rows: [{ total }] } = await query(
		`SELECT COUNT(*)::int AS total FROM checkins WHERE challenge_id = $1 AND user_id = $2`,
		[id, userId]
	);

	return NextResponse.json({
		checkin,
		total_checkins: Number(total),
		squad_status: {
			hearts_left: membership[0].hearts_left,
			members_checked_in: Number(squadStatus.members_checked_in),
			members_total: Number(squadStatus.members_total),
		},
	}, { status: 201 });
}

// GET — Gallery: paginated checkins with user info
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const { searchParams } = new URL(req.url);
	const memberId = searchParams.get('member_id');
	const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
	const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
	const offset = (page - 1) * limit;

	// Check challenge exists and is active/completed
	const { rows: challenges } = await query(
		`SELECT status FROM challenges WHERE id = $1`,
		[id]
	);
	if (challenges.length === 0) {
		return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
	}
	if (!['active', 'completed'].includes(challenges[0].status)) {
		return NextResponse.json({ error: 'Challenge is not active or completed' }, { status: 409 });
	}

	// Build dynamic WHERE clause
	const queryParams: unknown[] = [id];
	let whereClause = 'ci.challenge_id = $1';
	if (memberId) {
		whereClause += ' AND ci.user_id = $2';
		queryParams.push(memberId);
	}

	const { rows: checkins } = await query(
		`SELECT ci.id, ci.user_id, ci.cycle_number, ci.evidence_url, ci.caption, ci.checked_in_at,
		        u.username, u.display_name, u.avatar_url
		 FROM checkins ci
		 JOIN users u ON u.id = ci.user_id
		 WHERE ${whereClause}
		 ORDER BY ci.checked_in_at DESC
		 LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
		[...queryParams, limit, offset]
	);

	const countParams = memberId ? [id, memberId] : [id];
	const { rows: [{ total }] } = await query(
		`SELECT COUNT(*)::int AS total FROM checkins ci WHERE ${whereClause}`,
		countParams
	);

	return NextResponse.json({ checkins, total: Number(total), page, limit });
}
