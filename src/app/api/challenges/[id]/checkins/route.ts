import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createCheckinSchema } from '@/lib/schemas/checkin';
import { getCurrentCycle } from '@/lib/services/checkinService';
import {
	uploadCheckinProof,
	type UploadedFile,
} from '@/lib/services/proofUploadService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getCaptionFromFormData(value: FormDataEntryValue | null): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const caption = value.trim();

	if (!caption) {
		return null;
	}

	return caption;
}
function isUploadedFile(value: FormDataEntryValue | null): value is UploadedFile {
	return (
		!!value &&
		typeof value === 'object' &&
		'arrayBuffer' in value &&
		typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function' &&
		'size' in value &&
		typeof (value as { size?: unknown }).size === 'number' &&
		'type' in value &&
		typeof (value as { type?: unknown }).type === 'string'
	);
}

async function resolveCheckinPayload(params: {
	req: NextRequest;
	challengeId: string;
	userId: string;
	cycleNumber: number;
}) {
	const { req, challengeId, userId, cycleNumber } = params; const contentType = req.headers.get('content-type') || '';

	if (contentType.includes('multipart/form-data')) {
		let formData: FormData;

		try {
			formData = await req.formData();
		} catch (error) {
			console.error('[CHECKIN_MULTIPART_PARSE_ERROR]', {
				challengeId,
				userId,
				cycleNumber,
				error,
			});

			return {
				ok: false as const,
				response: NextResponse.json(
					{ error: 'Invalid multipart form data' },
					{ status: 400 }
				),
			};
		}

		const proof = formData.get('proof');
		const caption = getCaptionFromFormData(formData.get('caption'));

		if (!isUploadedFile(proof)) {
			return {
				ok: false as const,
				response: NextResponse.json(
					{ error: 'proof image file is required' },
					{ status: 400 }
				),
			};
		}

		if (caption && caption.length > 280) {
			return {
				ok: false as const,
				response: NextResponse.json(
					{ error: 'Caption must be at most 280 characters' },
					{ status: 400 }
				),
			};
		}

		try {
			const { evidenceUrl } = await uploadCheckinProof({
				file: proof,
				challengeId,
				userId,
				cycleNumber,
			});

			return {
				ok: true as const,
				evidenceUrl,
				caption,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Could not upload proof image';

			const isValidationError =
				message.includes('empty') ||
				message.includes('smaller than') ||
				message.includes('supported');

			return {
				ok: false as const,
				response: NextResponse.json(
					{ error: message },
					{ status: isValidationError ? 400 : 500 }
				),
			};
		}
	}

	let body: unknown;

	try {
		body = await req.json();
	} catch {
		body = {};
	}

	const parsed = createCheckinSchema.safeParse(body);

	if (!parsed.success) {
		return {
			ok: false as const,
			response: NextResponse.json(
				{ error: 'Validation failed', details: parsed.error.issues },
				{ status: 400 }
			),
		};
	}

	return {
		ok: true as const,
		evidenceUrl: parsed.data.evidenceUrl || null,
		caption: parsed.data.caption?.trim() || null,
	};
}

// POST — Submit a check-in for the current cycle
export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const requestUrl = new URL(req.url);
		const userId = requestUrl.searchParams.get('user_id');

		if (!userId) {
			return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 });
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

		// Check duplicate checkin for this cycle before parsing/uploading the file.
		// This avoids saving an orphan proof image when the user has already checked in.
		const { rows: existing } = await query(
			`SELECT id FROM checkins WHERE challenge_id = $1 AND user_id = $2 AND cycle_number = $3`,
			[id, userId, cycleNumber]
		);

		if (existing.length > 0) {
			return NextResponse.json({ error: 'Already checked in for this cycle' }, { status: 409 });
		}

		const resolvedPayload = await resolveCheckinPayload({
			req,
			challengeId: id,
			userId,
			cycleNumber,
		});

		if (!resolvedPayload.ok) {
			return resolvedPayload.response;
		}

		if (!resolvedPayload.evidenceUrl) {
			return NextResponse.json(
				{ error: 'Check-in proof image is required' },
				{ status: 400 }
			);
		}

		// Insert checkin
		let checkin: unknown;

		try {
			const { rows } = await query(
				`INSERT INTO checkins (challenge_id, user_id, cycle_number, evidence_url, caption)
				 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
				[id, userId, cycleNumber, resolvedPayload.evidenceUrl, resolvedPayload.caption]
			);

			checkin = rows[0];
		} catch (error) {
			console.error('[CHECKIN_INSERT_ERROR]', {
				challengeId: id,
				userId,
				cycleNumber,
				error,
			});
			throw error;
		}

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
	} catch (error) {
		console.error('[CHECKIN_POST_ERROR]', error);

		return NextResponse.json(
			{
				error: 'Could not submit check-in',
				...(process.env.NODE_ENV === 'development' && error instanceof Error
					? { details: error.message }
					: {}),
			},
			{ status: 500 }
		);
	}
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
