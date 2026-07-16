import assert from 'node:assert/strict';
import test from 'node:test';

import {
	selectSites,
	withBrand,
	withIndividualBrands,
	withoutDuplicateNames,
} from './site-catalogue.ts';

const sources = [
	{ category: 'news', name: 'home', url: 'https://example.com' },
	{ category: 'sport', name: 'sport', url: 'https://example.com/sport' },
];
const sites = withBrand('example', sources);

test('applies a shared brand without mutating site definitions', () => {
	assert.deepEqual(sites.map(({ brand }) => brand), ['example', 'example']);
	assert.equal('brand' in sources[0], false);
});

test('can derive a separate brand from each site name', () => {
	assert.deepEqual(
		withIndividualBrands(sources).map(({ brand }) => brand),
		['home', 'sport'],
	);
});

test('removes site names that already exist', () => {
	assert.deepEqual(withoutDuplicateNames(sources, [sources[0]]), [sources[1]]);
});

test('selects all sites, a brand, or one named site', () => {
	assert.equal(selectSites(sites, {}), sites);
	assert.deepEqual(selectSites(sites, { brand: 'example' }), sites);
	assert.deepEqual(selectSites(sites, { name: 'sport' }), [sites[1]]);
});

test('rejects conflicting and unknown selections', () => {
	assert.throws(
		() => selectSites(sites, { brand: 'example', name: 'home' }),
		/Specify either brand or name/,
	);
	assert.throws(() => selectSites(sites, { brand: 'missing' }), /Unknown brand: missing/);
	assert.throws(() => selectSites(sites, { name: 'missing' }), /Unknown site name: missing/);
});
