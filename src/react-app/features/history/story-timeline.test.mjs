import assert from "node:assert/strict";
import test from "node:test";

import { timelinePoints } from "./story-timeline.ts";

test("plots single and short timelines inside the visible chart area", () => {
	assert.deepEqual(timelinePoints([62]), [{ value: 62, x: 50, y: 50 }]);

	const points = timelinePoints([62, 63]);
	assert.equal(points[0].x, 8);
	assert.equal(points[1].x, 92);
	assert.ok(points.every(({ y }) => y >= 12 && y <= 88));
	assert.notEqual(points[0].y, points[1].y);
});
