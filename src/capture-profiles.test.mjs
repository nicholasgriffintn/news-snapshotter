import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCaptureProfile } from './capture-profiles.ts';

function site(overrides = {}) {
	return {
		brand: 'example',
		category: 'news',
		name: 'example-home',
		url: 'https://example.com',
		...overrides,
	};
}

test('resolves safe desktop and mobile defaults', () => {
	const profile = resolveCaptureProfile(site());

	assert.deepEqual(profile.devices, ['desktop', 'mobile']);
	assert.deepEqual(profile.deviceConfig.desktop.viewport, { height: 1008, width: 1740 });
	assert.deepEqual(profile.deviceConfig.mobile.viewport, { height: 915, width: 412 });
	assert.equal(profile.deviceConfig.desktop.screenshot.fullPage, true);
	assert.ok(profile.deviceConfig.desktop.hideSelectors.includes('#onetrust-banner-sdk'));
	assert.ok(profile.failureIndicators.some(({ reason }) => reason === 'captcha'));
});

test('uses an explicit profile instead of the site brand', () => {
	const profile = resolveCaptureProfile(site({ brand: 'bbc-local', profile: 'bbc' }));

	assert.ok(profile.deviceConfig.desktop.cookies.some(({ name }) => name === 'ckns_policy'));
	assert.ok(profile.deviceConfig.mobile.cookies.some(({ name }) => name === 'ckns_explicit'));
});

test('merges brand overrides without dropping default protection', () => {
	const profile = resolveCaptureProfile(site({ brand: 'bloomberg' }));

	assert.deepEqual(profile.deviceConfig.desktop.viewport, { height: 1080, width: 1920 });
	assert.ok(profile.deviceConfig.desktop.hideSelectors.includes('#onetrust-banner-sdk'));
	assert.ok(profile.deviceConfig.desktop.blockSelectors.some(({ reason }) => reason === 'captcha'));
	assert.ok(profile.failureIndicators.some(({ reason }) => reason === 'security-systems'));
});

test('falls back to defaults for an unknown profile', () => {
	const profile = resolveCaptureProfile(site({ profile: 'missing' }));

	assert.deepEqual(profile.deviceConfig.desktop.viewport, { height: 1008, width: 1740 });
	assert.deepEqual(profile.deviceConfig.desktop.cookies, []);
});

test('returns fresh arrays so one resolution cannot contaminate another', () => {
	const first = resolveCaptureProfile(site({ brand: 'bbc' }));
	first.deviceConfig.desktop.hideSelectors.push('.mutation');
	first.failureIndicators.push({ reason: 'mutation', text: 'mutation' });

	const second = resolveCaptureProfile(site({ brand: 'bbc' }));
	assert.equal(second.deviceConfig.desktop.hideSelectors.includes('.mutation'), false);
	assert.equal(second.failureIndicators.some(({ reason }) => reason === 'mutation'), false);
});
