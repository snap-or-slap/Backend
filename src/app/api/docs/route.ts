import { NextResponse } from 'next/server';
import apiDocs from './openapi.json';

export async function GET() {
	return NextResponse.json(apiDocs);
}
