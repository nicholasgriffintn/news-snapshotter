export type TimelinePoint = {
	value: number;
	x: number;
	y: number;
};

export function timelinePoints(values: number[]): TimelinePoint[] {
	if (values.length === 0) {
		return [];
	}
	if (values.length === 1) {
		return [{ value: values[0], x: 50, y: 50 }];
	}

	const minimum = Math.min(...values);
	const maximum = Math.max(...values);
	const spread = maximum - minimum;
	const lowerBound = spread === 0 ? minimum - 1 : minimum - spread * 0.15;
	const upperBound = spread === 0 ? maximum + 1 : maximum + spread * 0.15;

	return values.map((value, index) => ({
		value,
		x: 8 + (index / (values.length - 1)) * 84,
		y: 12 + ((value - lowerBound) / (upperBound - lowerBound)) * 76,
	}));
}
