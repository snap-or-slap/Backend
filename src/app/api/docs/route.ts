import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import apiDocs from './openapi.json';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
	const forwardedProto = request.headers.get('x-forwarded-proto');
	const host = request.headers.get('host');
	const requestOrigin =
		forwardedProto && host ? `${forwardedProto}://${host}` : undefined;
	const serverUrl = process.env.APP_BASE_URL || requestOrigin;

	const docs = {
		...apiDocs,
		servers: serverUrl
			? [
					{
						url: serverUrl,
						description: 'Current deployment',
					},
					...apiDocs.servers.filter((server) => server.url !== serverUrl),
				]
			: apiDocs.servers,
	};

	return NextResponse.json(docs);
}
