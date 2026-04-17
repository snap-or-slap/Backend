import { z } from 'zod';

export const friendRequestSchema = z.object({
	receiver_id: z.string().uuid('Invalid receiver_id'),
}).strip();

export const respondFriendRequestSchema = z.object({
	action: z.enum(['accept', 'decline'], { error: 'Action must be accept or decline' }),
}).strip();

export type FriendRequestInput = z.infer<typeof friendRequestSchema>;
export type RespondFriendRequestInput = z.infer<typeof respondFriendRequestSchema>;
