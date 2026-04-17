import { NextResponse } from 'next/server';

const API_DOCS = {
	openapi: '3.0.3',
	info: {
		title: 'SOS App — Backend API',
		version: '0.2.0',
		description: 'Snap or Slap challenge app. Sprint 2: Auth & User Profile APIs. All endpoints return JSON.',
	},
	servers: [
		{ url: 'https://backend-production-2ba1.up.railway.app', description: 'Railway Production' },
		{ url: 'http://localhost:3000', description: 'Local Development' },
	],
	paths: {
		'/api/health': {
			get: {
				tags: ['System'],
				summary: 'Health check',
				description: 'Returns server status and uptime. No auth required.',
				responses: {
					'200': {
						description: 'Server is healthy',
						content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' }, uptime: { type: 'number', example: 123.45 } } } } },
					},
				},
			},
		},
		'/api/auth/register': {
			post: {
				tags: ['Auth'],
				summary: 'Register new user',
				description: 'Create account with email, password, username. Returns JWT tokens.',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								required: ['email', 'password', 'username', 'terms_agreed'],
								properties: {
									email: { type: 'string', format: 'email', example: 'user@example.com' },
									password: { type: 'string', minLength: 8, example: 'MyPass123!' },
									username: { type: 'string', minLength: 4, maxLength: 20, pattern: '^[a-zA-Z0-9_]+$', example: 'cool_user' },
									terms_agreed: { type: 'boolean', example: true },
								},
							},
						},
					},
				},
				responses: {
					'201': { description: 'User created, tokens returned' },
					'400': { description: 'Validation error' },
					'409': { description: 'Email or username already taken' },
				},
			},
		},
		'/api/auth/login': {
			post: {
				tags: ['Auth'],
				summary: 'Sign in',
				description: 'Authenticate with email + password. Returns JWT tokens.',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								required: ['email', 'password'],
								properties: {
									email: { type: 'string', format: 'email', example: 'user@example.com' },
									password: { type: 'string', example: 'MyPass123!' },
								},
							},
						},
					},
				},
				responses: {
					'200': { description: 'Login successful, tokens returned' },
					'400': { description: 'Validation error' },
					'401': { description: 'Invalid credentials' },
					'403': { description: 'Account disabled' },
				},
			},
		},
		'/api/auth/check-username': {
			get: {
				tags: ['Auth'],
				summary: 'Check username availability',
				description: 'Check if a username is available. No auth required. Test in browser: /api/auth/check-username?username=cool_user',
				parameters: [
					{
						name: 'username',
						in: 'query',
						required: true,
						schema: { type: 'string', minLength: 4, example: 'cool_user' },
					},
				],
				responses: {
					'200': {
						description: 'Username availability',
						content: { 'application/json': { schema: { type: 'object', properties: { available: { type: 'boolean' } } } } },
					},
					'400': { description: 'Invalid username format' },
				},
			},
		},
		'/api/auth/refresh': {
			post: {
				tags: ['Auth'],
				summary: 'Refresh access token',
				description: 'Exchange refresh_token for new access_token. Old refresh_token is revoked (rotation).',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								required: ['refresh_token'],
								properties: {
									refresh_token: { type: 'string', example: 'your-refresh-token-here' },
								},
							},
						},
					},
				},
				responses: {
					'200': { description: 'New token pair' },
					'400': { description: 'Missing refresh_token' },
					'401': { description: 'Invalid/expired/revoked token' },
				},
			},
		},
		'/api/auth/signout': {
			post: {
				tags: ['Auth'],
				summary: 'Sign out',
				description: 'Revoke refresh token. Access token expires naturally (15min).',
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								required: ['refresh_token'],
								properties: {
									refresh_token: { type: 'string' },
								},
							},
						},
					},
				},
				responses: {
					'200': { description: 'Signed out successfully' },
					'400': { description: 'Missing refresh_token' },
				},
			},
		},
		'/api/users/me': {
			get: {
				tags: ['Users'],
				summary: 'Get user profile',
				description: 'Get profile by user_id query param. Test in browser: /api/users/me?user_id=UUID',
				parameters: [
					{
						name: 'user_id',
						in: 'query',
						required: true,
						schema: { type: 'string', format: 'uuid' },
						description: 'User UUID',
					},
				],
				responses: {
					'200': { description: 'User profile' },
					'400': { description: 'Missing user_id' },
					'404': { description: 'User not found' },
				},
			},
			patch: {
				tags: ['Users'],
				summary: 'Update user profile',
				description: 'Update display_name, bio, is_private. Requires user_id query param.',
				parameters: [
					{
						name: 'user_id',
						in: 'query',
						required: true,
						schema: { type: 'string', format: 'uuid' },
					},
				],
				requestBody: {
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									displayName: { type: 'string', maxLength: 50, example: 'Cool User' },
									bio: { type: 'string', maxLength: 200, example: 'Living the grind' },
									isPrivate: { type: 'boolean', example: false },
								},
							},
						},
					},
				},
				responses: {
					'200': { description: 'Updated profile' },
					'400': { description: 'Validation error' },
					'404': { description: 'User not found' },
				},
			},
		},
		'/api/test-data': {
			get: {
				tags: ['System'],
				summary: 'View all test data',
				description: 'Returns all users, challenges, members, checkins from the database. Test in browser.',
				responses: {
					'200': { description: 'All test data' },
					'500': { description: 'Database error' },
				},
			},
		},
	},
};

export async function GET() {
	return NextResponse.json(API_DOCS);
}
