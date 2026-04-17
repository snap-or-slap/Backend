import { z } from 'zod';

export const createCheckinSchema = z.object({
	evidenceUrl: z.string().url().optional(),
	caption: z.string().max(280).optional(),
}).strip();

export type CreateCheckinInput = z.infer<typeof createCheckinSchema>;
