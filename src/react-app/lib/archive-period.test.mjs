import assert from 'node:assert/strict';
import test from 'node:test';

import {
	DEFAULT_ARCHIVE_PERIOD,
	dateInputValue,
	matchesArchivePeriod,
} from './archive-period.ts';

const now = new Date(2026, 6, 16, 12);

function capturedAt(year, month, day, hour) {
	return new Date(year, month, day, hour).toISOString();
}

test('the default archive only includes the last three hours from today', () => {
	assert.equal(matchesArchivePeriod(capturedAt(2026, 6, 16, 10), DEFAULT_ARCHIVE_PERIOD, now), true);
	assert.equal(matchesArchivePeriod(capturedAt(2026, 6, 16, 8), DEFAULT_ARCHIVE_PERIOD, now), false);
	assert.equal(matchesArchivePeriod(capturedAt(2026, 6, 15, 23), DEFAULT_ARCHIVE_PERIOD, now), false);
});

test('rolling and calendar periods use distinct boundaries', () => {
	assert.equal(
		matchesArchivePeriod(
			capturedAt(2026, 6, 15, 13),
			{ ...DEFAULT_ARCHIVE_PERIOD, period: 'last-24-hours' },
			now,
		),
		true,
	);
	assert.equal(
		matchesArchivePeriod(
			capturedAt(2026, 6, 15, 8),
			{ ...DEFAULT_ARCHIVE_PERIOD, period: 'yesterday' },
			now,
		),
		true,
	);
});

test('a custom date matches the selected local calendar day', () => {
	const capture = capturedAt(2025, 10, 9, 8);

	assert.equal(
		matchesArchivePeriod(capture, { ...DEFAULT_ARCHIVE_PERIOD, day: '2025-11-09', period: 'day' }, now),
		true,
	);
	assert.equal(dateInputValue(new Date(2025, 10, 9)), '2025-11-09');
});
