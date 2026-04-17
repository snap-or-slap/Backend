import { z } from 'zod';

export const createChallengeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional(),
  durationDays: z.number().int().min(1).max(365),
  frequency: z.enum(['daily', 'custom']),
  frequencyDays: z.array(z.number().int().min(0).max(6)).optional(),
  resetTime: z.string().regex(/^\d{2}:\d{2}$/, 'Reset time must be HH:MM').default('00:00'),
  totalHearts: z.number().int().min(1).max(99).default(3),
  maxMembers: z.number().int().min(2).max(50).default(10),
  isPrivate: z.boolean().default(false),
}).strip();

export const updateChallengeSchema = createChallengeSchema.partial();

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>;
