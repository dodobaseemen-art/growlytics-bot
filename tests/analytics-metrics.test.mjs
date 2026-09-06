import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEngagement,
  calculatePeakHour,
  countUniqueActiveUsers
} from '../dist/utils/analytics.js';

test('counts unique active users once per user', () => {
  assert.equal(countUniqueActiveUsers([101, 101, 202, null]), 2);
});

test('selects the busiest peak hour and resolves ties to the earlier hour', () => {
  assert.equal(calculatePeakHour([14, 15, 14, 9, 15, 14]), 14);
  assert.equal(calculatePeakHour([15, 9]), 9);
  assert.equal(calculatePeakHour([]), null);
});

test('calculates engagement as messages per unique active user', () => {
  assert.equal(calculateEngagement(10, 4), 2.5);
  assert.equal(calculateEngagement(10, 0), 0);
});
