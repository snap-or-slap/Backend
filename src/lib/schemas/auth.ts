import { z } from 'zod';

export const registerSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	username: z
		.string()
		.min(4, 'Username must be 4-20 characters')
		.max(20, 'Username must be 4-20 characters')
		.regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
	terms_agreed: z.literal(true, { errorMap: () => ({ message: 'You must agree to the terms' }) }),
}).strip();

export const loginSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(1, 'Password is required'),
}).strip();

export const refreshSchema = z.object({
	refresh_token: z.string().min(1, 'Refresh token is required'),
}).strip();

export const signoutSchema = z.object({
	refresh_token: z.string().min(1, 'Refresh token is required'),
}).strip();

export const checkUsernameSchema = z.object({
	username: z
		.string()
		.min(4, 'Username must be at least 4 characters')
		.max(20, 'Username must be at most 20 characters')
		.regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type SignoutInput = z.infer<typeof signoutSchema>;
