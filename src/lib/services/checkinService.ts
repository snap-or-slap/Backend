/**
 * Calculate the current cycle number for a challenge.
 * Cycle 1 = first day, Cycle 2 = second day, etc.
 */
export function getCurrentCycle(startAt: Date | string): number {
	const start = typeof startAt === 'string' ? new Date(startAt) : startAt;
	const now = new Date();
	const msSinceStart = now.getTime() - start.getTime();
	if (msSinceStart < 0) return 0;
	return Math.floor(msSinceStart / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Get the next reset time based on the challenge's reset_time setting.
 */
export function getNextResetTime(resetTime: string): Date {
	const [h, m] = resetTime.split(':').map(Number);
	const now = new Date();
	const todayReset = new Date(now);
	todayReset.setUTCHours(h, m, 0, 0);

	if (now.getTime() < todayReset.getTime()) return todayReset;

	const tomorrowReset = new Date(todayReset);
	tomorrowReset.setUTCDate(tomorrowReset.getUTCDate() + 1);
	return tomorrowReset;
}
