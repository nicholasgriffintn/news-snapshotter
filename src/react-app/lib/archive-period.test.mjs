import assert from 'node:assert/strict';
import test from 'node:test';

import {
	DEFAULT_ARCHIVE_PERIOD,
	dateInputValue,
	matchesArchivePeriod,
	periodDescription,
} from './archive-period.ts';

const HOUR = 60 * 60 * 1_000;
const now = new Date(2026, 6, 16, 12);

function capturedAt(year, month, day, hour, minute = 0) {
	return new Date(year, month, day, hour, minute).toISOString();
}

function hoursBefore(reference, hours, milliseconds = 0) {
	return new Date(reference.getTime() - hours * HOUR - milliseconds).toISOString();
}

test('the default archive includes captures from the last three hours today', () => {
	assert.equal(matchesArchivePeriod(hoursBefore(now, 2), DEFAULT_ARCHIVE_PERIOD, now), true);
	assert.equal(matchesArchivePeriod(now.toISOString(), DEFAULT_ARCHIVE_PERIOD, now), true);
});

test('the three-hour cut-off is inclusive and excludes older captures', () => {
	assert.equal(matchesArchivePeriod(hoursBefore(now, 3), DEFAULT_ARCHIVE_PERIOD, now), true);
	assert.equal(matchesArchivePeriod(hoursBefore(now, 3, 1), DEFAULT_ARCHIVE_PERIOD, now), false);
});

test('the default archive never reaches into yesterday', () => {
	const shortlyAfterMidnight = new Date(2026, 6, 16, 1);
	const withinThreeHoursButYesterday = capturedAt(2026, 6, 15, 23, 30);

	assert.equal(
		matchesArchivePeriod(withinThreeHoursButYesterday, DEFAULT_ARCHIVE_PERIOD, shortlyAfterMidnight),
		false,
	);
});

test('the 24-hour filter includes its boundary and excludes older captures', () => {
	const filter = { ...DEFAULT_ARCHIVE_PERIOD, period: 'last-24-hours' };

	assert.equal(matchesArchivePeriod(hoursBefore(now, 24), filter, now), true);
	assert.equal(matchesArchivePeriod(hoursBefore(now, 24, 1), filter, now), false);
});

test('the 24-hour filter can include captures from yesterday', () => {
	const filter = { ...DEFAULT_ARCHIVE_PERIOD, period: 'last-24-hours' };

	assert.equal(matchesArchivePeriod(capturedAt(2026, 6, 15, 13), filter, now), true);
});

test('the yesterday filter includes the whole previous local calendar day', () => {
	const filter = { ...DEFAULT_ARCHIVE_PERIOD, period: 'yesterday' };

	assert.equal(matchesArchivePeriod(capturedAt(2026, 6, 15, 0), filter, now), true);
	assert.equal(matchesArchivePeriod(capturedAt(2026, 6, 15, 23, 59), filter, now), true);
});

test('the yesterday filter excludes today and the day before yesterday', () => {
	const filter = { ...DEFAULT_ARCHIVE_PERIOD, period: 'yesterday' };

	assert.equal(matchesArchivePeriod(capturedAt(2026, 6, 16, 0), filter, now), false);
	assert.equal(matchesArchivePeriod(capturedAt(2026, 6, 14, 23, 59), filter, now), false);
});

test('a custom date includes captures from the selected local calendar day', () => {
	const filter = { day: '2025-11-09', period: 'day' };

	assert.equal(matchesArchivePeriod(capturedAt(2025, 10, 9, 0), filter, now), true);
	assert.equal(matchesArchivePeriod(capturedAt(2025, 10, 9, 23, 59), filter, now), true);
});

test('a custom date excludes other days and an empty selection', () => {
	assert.equal(
		matchesArchivePeriod(
			capturedAt(2025, 10, 8, 23, 59),
			{ day: '2025-11-09', period: 'day' },
			now,
		),
		false,
	);
	assert.equal(
		matchesArchivePeriod(capturedAt(2025, 10, 9, 8), { day: '', period: 'day' }, now),
		false,
	);
});

test('invalid and future capture timestamps are rejected', () => {
	assert.equal(matchesArchivePeriod('not-a-date', DEFAULT_ARCHIVE_PERIOD, now), false);
	assert.equal(
		matchesArchivePeriod(new Date(now.getTime() + 1).toISOString(), DEFAULT_ARCHIVE_PERIOD, now),
		false,
	);
});

test('date input values use padded local calendar components', () => {
	assert.equal(dateInputValue(new Date(2025, 0, 9)), '2025-01-09');
	assert.equal(dateInputValue(new Date(2026, 10, 19)), '2026-11-19');
});

test('period descriptions identify presets and selected custom dates', () => {
	assert.equal(periodDescription(DEFAULT_ARCHIVE_PERIOD), 'Today · last 3 hours');
	assert.equal(
		periodDescription({ ...DEFAULT_ARCHIVE_PERIOD, period: 'last-24-hours' }),
		'Rolling 24 hours',
	);
	assert.equal(
		periodDescription({ ...DEFAULT_ARCHIVE_PERIOD, period: 'yesterday' }),
		'Yesterday',
	);
	assert.equal(periodDescription({ day: '', period: 'day' }), 'Choose a day');
	assert.equal(periodDescription({ day: '2025-11-09', period: 'day' }), '9 November 2025');
});
