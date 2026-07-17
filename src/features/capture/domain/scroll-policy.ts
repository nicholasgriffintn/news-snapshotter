export type ProgressiveScrollConfig = {
	maxDurationMs: number;
	maxSteps: number;
	minDelayMs: number;
	settleDelayMs: number;
	viewportRatio: { max: number; min: number };
};

export const DEFAULT_PROGRESSIVE_SCROLL: ProgressiveScrollConfig = {
	maxDurationMs: 45_000,
	maxSteps: 80,
	minDelayMs: 120,
	settleDelayMs: 750,
	viewportRatio: { max: 0.85, min: 0.6 },
};
