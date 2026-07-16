import assert from 'node:assert/strict';
import test from 'node:test';

import { displayName, groupLabel, timeLabel } from './format.ts';

test('turns storage identifiers into display names', () => {
	assert.equal(displayName('belfast-telegraph'), 'Belfast Telegraph');
	assert.equal(displayName('bbc'), 'Bbc');
});

test('formats capture times using the local 24-hour clock', () => {
	const capturedAt = new Date(2026, 6, 16, 9, 5).toISOString();
	assert.match(timeLabel(capturedAt), /09:05/);
});

test('labels historical capture groups with a full date and time', () => {
	const capturedAt = new Date(2020, 0, 2, 9, 5).toISOString();
	assert.match(groupLabel(capturedAt), /Thursday, 2 January 2020/);
	assert.match(groupLabel(capturedAt), /09:05/);
});
