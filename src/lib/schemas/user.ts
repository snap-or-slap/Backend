import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(200).optional(),
  isPrivate: z.boolean().optional(),
}).strip();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
