import { query } from '@/lib/db';
import { getCurrentCycle } from './checkinService';

// ============================================
// Formation → Active transition
// ============================================
const MIN_ACCEPTED_MEMBERS = 2;

type FormationSkipReason =
	| 'not_enough_accepted_members'
	| 'not_all_accepted_members_ready'
	| 'already_processed';

export type FormationTransitionResult = {
	transitioned: string[];
	activated: string[];
	cancelled: string[];
	skipped: Array<{
		challenge_id: string;
		reason: FormationSkipReason;
		accepted_count: number;
		ready_count: number;
	}>;
	transitioned_count: number;
	cancelled_count: number;
	skipped_count: number;
};

export async function transitionDueFormationChallenges(now = new Date()): Promise<FormationTransitionResult> {
	const transitioned: string[] = [];
	const skipped: FormationTransitionResult['skipped'] = [];

	const { rows: challenges } = await query(
		`SELECT c.id, c.title, c.start_at, c.creator_id, c.total_hearts, c.hearts_left,
		        COUNT(cm.user_id) FILTER (WHERE cm.status = 'accepted')::int AS accepted_count,
		        COUNT(cm.user_id) FILTER (WHERE cm.status = 'accepted' AND cm.is_ready = true)::int AS ready_count
		 FROM challenges c
		 LEFT JOIN challenge_members cm ON cm.challenge_id = c.id
		 WHERE c.status = 'formation'
		   AND c.start_at IS NOT NULL
		   AND c.start_at <= $1
		 GROUP BY c.id`,
		[now]
	);

	for (const ch of challenges) {
		const acceptedCount = Number(ch.accepted_count ?? 0);
		const readyCount = Number(ch.ready_count ?? 0);

		if (acceptedCount < MIN_ACCEPTED_MEMBERS) {
			skipped.push({
				challenge_id: ch.id as string,
				reason: 'not_enough_accepted_members',
				accepted_count: acceptedCount,
				ready_count: readyCount,
			});
			continue;
		}

		if (readyCount < acceptedCount) {
			skipped.push({
				challenge_id: ch.id as string,
				reason: 'not_all_accepted_members_ready',
				accepted_count: acceptedCount,
				ready_count: readyCount,
			});
			continue;
		}

		const { rowCount } = await query(
			`UPDATE challenges
			 SET status = 'active',
			     current_step = COALESCE(current_step, 0),
			     last_processed_cycle = COALESCE(last_processed_cycle, 0),
			     hearts_left = COALESCE(hearts_left, total_hearts),
			     updated_at = NOW()
			 WHERE id = $1 AND status = 'formation'`,
			[ch.id]
		);

		if (!rowCount || rowCount === 0) {
			skipped.push({
				challenge_id: ch.id as string,
				reason: 'already_processed',
				accepted_count: acceptedCount,
				ready_count: readyCount,
			});
			continue;
		}

		const { rows: members } = await query(
			`SELECT user_id FROM challenge_members WHERE challenge_id = $1 AND status = 'accepted'`,
			[ch.id]
		);

		for (const m of members) {
			await query(
				`INSERT INTO notifications (user_id, type, metadata)
				 VALUES ($1, 'challenge_start', $2)`,
				[m.user_id, JSON.stringify({
					challenge_id: ch.id,
					challengeId: ch.id,
					challenge_title: ch.title,
					challengeTitle: ch.title,
				})]
			);
		}

		for (const m of members) {
			await query(
				`INSERT INTO activities (user_id, type, metadata)
				 VALUES ($1, 'challenge_joined', $2)`,
				[m.user_id, JSON.stringify({ challenge_id: ch.id, title: ch.title })]
			);
		}

		transitioned.push(ch.id as string);
		console.log(`[CRON] formation-to-active: challenge ${ch.id} activated with ${acceptedCount} ready members`);
	}

	console.log(`[CRON] formation-to-active: processed ${challenges.length} due challenges (${transitioned.length} activated, ${skipped.length} skipped)`);
	return {
		transitioned,
		activated: transitioned,
		cancelled: [],
		skipped,
		transitioned_count: transitioned.length,
		cancelled_count: 0,
		skipped_count: skipped.length,
	};
}

export async function processFormationTransitions(): Promise<FormationTransitionResult> {
	return transitionDueFormationChallenges();
}

// ============================================
// Daily Heart Deduction
// ============================================
export async function processHeartDeductions(): Promise<{
	processed: Array<{
		challenge_id: string;
		cycle: number;
		missed_count: number;
		hearts_left: number;
		new_status: string;
	}>;
	skipped: number;
}> {
	const processed: Array<{
		challenge_id: string;
		cycle: number;
		missed_count: number;
		hearts_left: number;
		new_status: string;
	}> = [];

	// Find active challenges that need processing
	const { rows: challenges } = await query(
		`SELECT c.id, c.title, c.start_at, c.reset_time, c.hearts_left, c.total_hearts,
		        c.duration_days, c.current_step, c.last_processed_cycle
		 FROM challenges c
		 WHERE c.status = 'active'`
	);

	let skipped = 0;

	for (const ch of challenges) {
		const currentCycle = getCurrentCycle(ch.start_at);
		if (currentCycle <= 0) { skipped++; continue; }

		// The cycle to process is the one that just ended (currentCycle - 1)
		// We process when current cycle > last_processed_cycle + 1
		// meaning the previous cycle's reset has passed
		const cycleToProcess = currentCycle - 1;
		if (cycleToProcess <= (ch.last_processed_cycle as number)) {
			skipped++;
			continue;
		}

		// Optimistic lock: set last_processed_cycle FIRST
		const { rowCount } = await query(
			`UPDATE challenges SET last_processed_cycle = $1
			 WHERE id = $2 AND last_processed_cycle < $1`,
			[cycleToProcess, ch.id]
		);
		if (!rowCount || rowCount === 0) { skipped++; continue; }

		// Get accepted members
		const { rows: members } = await query(
			`SELECT user_id FROM challenge_members WHERE challenge_id = $1 AND status = 'accepted'`,
			[ch.id]
		);

		// Find who checked in for the processed cycle
		const { rows: checkins } = await query(
			`SELECT DISTINCT user_id FROM checkins WHERE challenge_id = $1 AND cycle_number = $2`,
			[ch.id, cycleToProcess]
		);
		const checkedInSet = new Set(checkins.map((c) => c.user_id as string));
		const missedMembers = members.filter((m) => !checkedInSet.has(m.user_id as string));

		let heartsLeft = ch.hearts_left as number;
		let newStatus = 'active';
		let newStep = (ch.current_step as number) + 1;

		if (missedMembers.length > 0) {
			heartsLeft -= 1;
		}

		if (heartsLeft <= 0) {
			newStatus = 'failed';
		} else if (newStep >= (ch.duration_days as number)) {
			newStatus = 'completed';
		}

		// Atomic update
		await query(
			`UPDATE challenges SET hearts_left = $1, current_step = $2, status = $3::challenge_status,
			        end_reason = CASE WHEN $3 = 'failed' THEN 'out_of_hearts'::challenge_end_reason
			                         WHEN $3 = 'completed' THEN 'completed'::challenge_end_reason
			                         ELSE end_reason END,
			        updated_at = NOW()
			 WHERE id = $4`,
			[heartsLeft, newStep, newStatus, ch.id]
		);

		// Notifications for heart loss
		if (missedMembers.length > 0) {
			const missedNames = missedMembers.map((m) => m.user_id as string);
			for (const m of members) {
				await query(
					`INSERT INTO notifications (user_id, type, metadata)
					 VALUES ($1, 'heart_lost', $2)`,
					[m.user_id, JSON.stringify({
						challenge_id: ch.id,
						title: ch.title,
						cycle: cycleToProcess,
						hearts_left: heartsLeft,
						missed_members: missedNames,
					})]
				);
			}
		}

		// If challenge ended, create snapshot
		if (newStatus === 'completed' || newStatus === 'failed') {
			await createCompletionSnapshot(ch.id as string, newStatus, newStep);
		}

		processed.push({
			challenge_id: ch.id as string,
			cycle: cycleToProcess,
			missed_count: missedMembers.length,
			hearts_left: heartsLeft,
			new_status: newStatus,
		});

		console.log(`[CRON] heart-deduction: challenge ${ch.id} cycle ${cycleToProcess} -${missedMembers.length > 0 ? 1 : 0} heart, ${heartsLeft} left, status=${newStatus}`);
	}

	console.log(`[CRON] heart-deduction: processed ${processed.length}, skipped ${skipped}`);
	return { processed, skipped };
}

// ============================================
// Completion Snapshot
// ============================================
export async function createCompletionSnapshot(
	challengeId: string,
	endStatus: string,
	actualSteps: number
): Promise<Record<string, unknown>> {
	// Get challenge info
	const { rows: [ch] } = await query(
		`SELECT id, title, duration_days, hearts_left, total_hearts FROM challenges WHERE id = $1`,
		[challengeId]
	);
	if (!ch) throw new Error(`Challenge ${challengeId} not found`);

	// Get all accepted members
	const { rows: members } = await query(
		`SELECT cm.user_id, u.username, u.display_name
		 FROM challenge_members cm
		 JOIN users u ON u.id = cm.user_id
		 WHERE cm.challenge_id = $1 AND cm.status = 'accepted'`,
		[challengeId]
	);

	// Get checkin counts per member
	const { rows: checkinCounts } = await query(
		`SELECT user_id, COUNT(*)::int AS checkin_count
		 FROM checkins WHERE challenge_id = $1
		 GROUP BY user_id`,
		[challengeId]
	);
	const countMap = new Map(checkinCounts.map((r) => [r.user_id as string, r.checkin_count as number]));

	// Find cycles where hearts were lost (cycles with any misses)
	const { rows: dangerRows } = await query(
		`SELECT DISTINCT ci.cycle_number
		 FROM generate_series(1, $2) AS gs(n)
		 LEFT JOIN checkins ci ON ci.challenge_id = $1 AND ci.cycle_number = gs.n
		 GROUP BY gs.n
		 HAVING COUNT(ci.id) < $3
		 ORDER BY gs.n`,
		[challengeId, actualSteps, members.length]
	);
	const dangerZones = dangerRows.map((r) => r.n as number);

	// Build member stats
	const memberStats = members.map((m) => {
		const count = countMap.get(m.user_id as string) || 0;
		return {
			user_id: m.user_id as string,
			username: m.username as string,
			display_name: m.display_name as string,
			checkin_count: count,
			completion_rate: actualSteps > 0 ? Math.round((count / actualSteps) * 1000) / 10 : 0,
		};
	});

	const totalCheckins = memberStats.reduce((sum, m) => sum + m.checkin_count, 0);
	const topPerformer = memberStats.reduce((best, m) =>
		m.completion_rate > best.completion_rate ? m : best, memberStats[0]);

	const finalStats = {
		total_checkins: totalCheckins,
		member_stats: memberStats,
		top_performer_id: topPerformer?.user_id || null,
		hearts_remaining: ch.hearts_left as number,
		actual_steps_completed: actualSteps,
		danger_zones: dangerZones,
		end_status: endStatus,
	};

	// Save to challenge
	await query(
		`UPDATE challenges SET final_stats = $1, updated_at = NOW() WHERE id = $2`,
		[JSON.stringify(finalStats), challengeId]
	);

	// Create activities for all members
	for (const m of members) {
		await query(
			`INSERT INTO activities (user_id, type, metadata)
			 VALUES ($1, 'challenge_completed', $2)`,
			[m.user_id, JSON.stringify({
				challenge_id: challengeId,
				title: ch.title,
				status: endStatus,
				completion_rate: memberStats.find((s) => s.user_id === m.user_id)?.completion_rate || 0,
			})]
		);
	}

	console.log(`[CRON] snapshot: challenge ${challengeId} final_stats saved (${totalCheckins} checkins, ${memberStats.length} members)`);
	return finalStats;
}
