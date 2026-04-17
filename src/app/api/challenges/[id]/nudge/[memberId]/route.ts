import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentCycle } from '@/lib/services/checkinService';

// POST — Send a nudge notification to a member who hasn't checked in
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
	const { id, memberId } = await params;
	const userId = new URL(req.url).searchParams.get('user_id');
	if (!userId) {
		return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
	}

	if (userId === memberId) {
		return NextResponse.json({ error: 'Cannot nudge yourself' }, { status: 400 });
	}

	// Check both are accepted members + get challenge info
	const { rows: members } = await query(
		`SELECT cm.user_id, c.status AS challenge_status, c.start_at
		 FROM challenge_members cm
		 JOIN challenges c ON c.id = cm.challenge_id
		 WHERE cm.challenge_id = $1 AND cm.user_id IN ($2, $3) AND cm.status = 'accepted'`,
		[id, userId, memberId]
	);

	if (members.length < 2) {
		return NextResponse.json({ error: 'Both users must be accepted members' }, { status: 403 });
	}

	if (members[0].challenge_status !== 'active') {
		return NextResponse.json({ error: 'Challenge is not active' }, { status: 409 });
	}

	// Check target hasn't already checked in this cycle
	const cycleNumber = getCurrentCycle(members[0].start_at);
	const { rows: targetCheckin } = await query(
		`SELECT id FROM checkins WHERE challenge_id = $1 AND user_id = $2 AND cycle_number = $3`,
		[id, memberId, cycleNumber]
	);
	if (targetCheckin.length > 0) {
		return NextResponse.json({ error: 'Member has already checked in for this cycle' }, { status: 400 });
	}

	// Rate limit: 1 nudge per target per day per challenge
	const { rows: recentNudge } = await query(
		`SELECT id FROM notifications
		 WHERE user_id = $1 AND type = 'nudge'
		   AND metadata->>'from_user_id' = $2
		   AND metadata->>'challenge_id' = $3
		   AND created_at > NOW() - INTERVAL '1 day'`,
		[memberId, userId, id]
	);
	if (recentNudge.length > 0) {
		return NextResponse.json({ error: 'Already nudged this member today' }, { status: 429 });
	}

	// Create notification
	await query(
		`INSERT INTO notifications (user_id, type, metadata)
		 VALUES ($1, 'nudge', $2)`,
		[memberId, JSON.stringify({ from_user_id: userId, challenge_id: id })]
	);

	return NextResponse.json({ message: 'Nudge sent successfully', target_user_id: memberId });
}

// GET — View recent nudges for a member in this challenge (browser-testable)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
	const { id, memberId } = await params;

	const { rows: nudges } = await query(
		`SELECT n.id, n.metadata, n.created_at, n.is_read
		 FROM notifications n
		 WHERE n.user_id = $1 AND n.type = 'nudge'
		   AND n.metadata->>'challenge_id' = $2
		 ORDER BY n.created_at DESC
		 LIMIT 10`,
		[memberId, id]
	);

	return NextResponse.json({ nudges, member_id: memberId, challenge_id: id });
}
