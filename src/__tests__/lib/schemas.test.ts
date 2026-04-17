import { describe, it, expect } from '@jest/globals';

describe('Validation Schemas', () => {
	describe('Auth schemas', () => {
		it('should reject username with 3 chars (too short)', () => {
			const { registerSchema } = require('@/lib/schemas/auth');
			const result = registerSchema.safeParse({
				email: 'test@test.com',
				password: 'Password123!',
				username: 'abc',
				terms_agreed: true,
			});
			expect(result.success).toBe(false);
		});

		it('should accept valid username with 13 chars', () => {
			const { registerSchema } = require('@/lib/schemas/auth');
			const result = registerSchema.safeParse({
				email: 'test@test.com',
				password: 'Password123!',
				username: 'valid_user123',
				terms_agreed: true,
			});
			expect(result.success).toBe(true);
		});

		it('should reject invalid email', () => {
			const { registerSchema } = require('@/lib/schemas/auth');
			const result = registerSchema.safeParse({
				email: 'not-an-email',
				password: 'Password123!',
				username: 'validuser',
				terms_agreed: true,
			});
			expect(result.success).toBe(false);
		});

		it('should reject password under 8 characters', () => {
			const { registerSchema } = require('@/lib/schemas/auth');
			const result = registerSchema.safeParse({
				email: 'test@test.com',
				password: 'short',
				username: 'validuser',
				terms_agreed: true,
			});
			expect(result.success).toBe(false);
		});

		it('should strip extra fields', () => {
			const { registerSchema } = require('@/lib/schemas/auth');
			const result = registerSchema.safeParse({
				email: 'test@test.com',
				password: 'Password123!',
				username: 'validuser',
				terms_agreed: true,
				extraField: 'should be stripped',
				anotherExtra: 123,
			});
			expect(result.success).toBe(true);
			expect(result.data.extraField).toBeUndefined();
			expect(result.data.anotherExtra).toBeUndefined();
		});
	});

	describe('validate helper', () => {
		it('should return parsed data on valid input', () => {
			const { validate } = require('@/lib/schemas/validate');
			const { registerSchema } = require('@/lib/schemas/auth');

			const data = validate(registerSchema, {
				email: 'test@test.com',
				password: 'Password123!',
				username: 'validuser',
				terms_agreed: true,
			});
			expect(data.email).toBe('test@test.com');
		});

		it('should throw AppError with field-level messages on invalid input', () => {
			const { validate } = require('@/lib/schemas/validate');
			const { registerSchema } = require('@/lib/schemas/auth');
			const { AppError } = require('@/lib/errors');

			expect(() =>
				validate(registerSchema, {
					email: 'bad',
					password: 'x',
					username: 'ab',
				})
			).toThrow(AppError);
		});
	});
});
