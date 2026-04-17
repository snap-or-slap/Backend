import { z } from 'zod';

export const updateProfileSchema = z.object({
	displayName: z.string().min(1).max(50).optional(),
	bio: z.string().max(200).optional(),
	isPrivate: z.boolean().optional(),
}).strip();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, 'Current password is required'),
	newPassword: z.string().min(8, 'Password must be at least 8 characters')
		.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
		.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
		.regex(/[0-9]/, 'Password must contain at least one number'),
}).strip();

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const activityQuerySchema = z.object({
	user_id: z.string().uuid(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(20),
	type: z.enum(['challenge_joined', 'challenge_completed', 'friend_added', 'badge_earned', 'checkin_done']).optional(),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
