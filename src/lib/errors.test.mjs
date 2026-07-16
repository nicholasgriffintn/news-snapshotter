import assert from 'node:assert/strict';
import test from 'node:test';

import { errorMessage } from './errors.ts';

test('returns Error messages and hides unknown thrown values', () => {
	assert.equal(errorMessage(new Error('capture failed')), 'capture failed');
	assert.equal(errorMessage('capture failed'), 'Unknown error');
	assert.equal(errorMessage(null), 'Unknown error');
});
