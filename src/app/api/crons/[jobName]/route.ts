import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { processFormationTransitions, processHeartDeductions } from '@/lib/services/cronService';

type JobName = 'formation-transition' | 'heart-deduction';

const JOB_DESCRIPTIONS: Record<JobName, string> = {
	'formation-transition': 'Transitions due formation challenges to active when start_at has passed, at least two accepted members exist, and all accepted members are ready.',
	'heart-deduction': 'Processes daily heart deductions for active challenges. Deducts 1 heart if any member missed check-in. Ends challenge if hearts reach 0 or duration reached.',
};

const JOB_HANDLERS: Record<JobName, () => Promise<unknown>> = {
	'formation-transition': processFormationTransitions,
	'heart-deduction': processHeartDeductions,
};

function isValidJob(name: string): name is JobName {
	return name in JOB_HANDLERS;
}

// GET — browser-testable job info (no auth needed)
export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ jobName: string }> }
) {
	const { jobName } = await params;

	if (!isValidJob(jobName)) {
		return NextResponse.json(
			{ error: `Unknown cron job: ${jobName}`, available_jobs: Object.keys(JOB_DESCRIPTIONS) },
			{ status: 404 }
		);
	}

	return NextResponse.json({
		job: jobName,
		description: JOB_DESCRIPTIONS[jobName],
		method: 'POST with Authorization: Bearer <CRON_SECRET> to execute',
		available_jobs: Object.keys(JOB_DESCRIPTIONS),
	});
}

// POST — execute cron job (requires CRON_SECRET)
export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ jobName: string }> }
) {
	const { jobName } = await params;

	// Auth check
	const authHeader = req.headers.get('Authorization');
	const token = authHeader?.replace('Bearer ', '');
	if (!token || token !== config.CRON_SECRET) {
		return NextResponse.json({ error: 'Unauthorized — invalid or missing CRON_SECRET' }, { status: 401 });
	}

	if (!isValidJob(jobName)) {
		return NextResponse.json(
			{ error: `Unknown cron job: ${jobName}`, available_jobs: Object.keys(JOB_DESCRIPTIONS) },
			{ status: 404 }
		);
	}

	const startTime = Date.now();

	try {
		const result = await JOB_HANDLERS[jobName]();
		const duration = Date.now() - startTime;

		return NextResponse.json({
			job: jobName,
			status: 'completed',
			duration_ms: duration,
			executed_at: new Date().toISOString(),
			result,
		});
	} catch (error) {
		const duration = Date.now() - startTime;
		console.error(`[CRON] ${jobName} failed:`, error);
		return NextResponse.json(
			{
				job: jobName,
				status: 'failed',
				duration_ms: duration,
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
