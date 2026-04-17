import { ZodSchema, ZodError } from 'zod';
import { AppError } from '@/lib/errors';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
	const result = schema.safeParse(data);
	if (!result.success) {
		const fieldErrors = result.error.issues.map((issue) => ({
			field: issue.path.join('.'),
			message: issue.message,
		}));
		throw new AppError('Validation failed', 400, fieldErrors);
	}
	return result.data;
}
