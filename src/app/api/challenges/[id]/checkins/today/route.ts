import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentCycle, getNextResetTime } from '@/lib/services/checkinService';

export const dynamic = 'force-dynamic';

// GET — Today's check-in status for all members
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const { rows: challenges } = await query(
		`SELECT status, start_at, duration_days, reset_time, hearts_left
		 FROM challenges WHERE id = $1`,
		[id]
	);
	if (challenges.length === 0) {
		return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
	}
	if (challenges[0].status !== 'active') {
		return NextResponse.json({ error: 'Challenge is not active' }, { status: 409 });
	}

	const challenge = challenges[0];
	const cycleNumber = getCurrentCycle(challenge.start_at);
	const resetAt = getNextResetTime(challenge.reset_time);
	const timeUntilReset = Math.floor((resetAt.getTime() - Date.now()) / 1000);

	const { rows: members } = await query(
		`SELECT cm.user_id, u.username, u.display_name, u.avatar_url,
		        ci.checked_in_at,
		        CASE WHEN ci.id IS NOT NULL THEN 'checked_in' ELSE 'pending' END AS status
		 FROM challenge_members cm
		 JOIN users u ON u.id = cm.user_id
		 LEFT JOIN checkins ci ON ci.challenge_id = cm.challenge_id
		   AND ci.user_id = cm.user_id AND ci.cycle_number = $2
		 WHERE cm.challenge_id = $1 AND cm.status = 'accepted'
		 ORDER BY ci.checked_in_at ASC NULLS LAST`,
		[id, cycleNumber]
	);

	return NextResponse.json({
		challenge_id: id,
		cycle_number: cycleNumber,
		duration_days: challenge.duration_days,
		hearts_left: challenge.hearts_left,
		reset_at: resetAt.toISOString(),
		time_until_reset: timeUntilReset,
		members,
	});
}
