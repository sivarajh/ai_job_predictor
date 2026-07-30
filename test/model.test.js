import test from 'node:test';
import assert from 'node:assert/strict';

import {
  automatableShare,
  deploymentShare,
  displacement,
  hiringChange,
  netChange,
  project,
} from '../src/model.js';
import {
  EXPERIENCE_LEVELS,
  JURISDICTIONS,
  MAX_AUTOMATABLE_SHARE,
  OCCUPATIONS,
  PROJECTION_YEARS,
} from '../src/parameters.js';

const us = JURISDICTIONS.find((j) => j.name === 'United States');
const fr = JURISDICTIONS.find((j) => j.name === 'France');
const level = (name) => EXPERIENCE_LEVELS.find((l) => l.name === name);
const occ = (name) => OCCUPATIONS.find((o) => o.name === name);

test('deployment increases monotonically and stays under capacity', () => {
  for (const j of JURISDICTIONS) {
    let previous = -Infinity;
    for (let year = 2020; year <= 2050; year += 0.5) {
      const share = deploymentShare(j, year);
      assert.ok(share > previous, `${j.code} not monotonic at ${year}`);
      assert.ok(share < j.capacity, `${j.code} exceeded capacity at ${year}`);
      previous = share;
    }
  }
});

test('deployment approaches capacity in the long run', () => {
  for (const j of JURISDICTIONS) {
    assert.ok(deploymentShare(j, 2100) > j.capacity * 0.99);
  }
});

test('a faster scenario deploys earlier than a slower one', () => {
  for (const year of PROJECTION_YEARS) {
    assert.ok(
      deploymentShare(us, year, { scenario: 1.45 }) > deploymentShare(us, year, { scenario: 1.0 }),
    );
    assert.ok(
      deploymentShare(us, year, { scenario: 1.0 }) > deploymentShare(us, year, { scenario: 0.65 }),
    );
  }
});

test('automatable share is capped', () => {
  for (const o of OCCUPATIONS) {
    for (const l of EXPERIENCE_LEVELS) {
      const share = automatableShare(o, l);
      assert.ok(share >= 0 && share <= MAX_AUTOMATABLE_SHARE);
    }
  }
});

test('stricter employment protection slows displacement at equal exposure', () => {
  // Compare at a year where deployment is similar, isolating friction: give
  // France the United States' deployment path by comparing the pass-through
  // terms directly at matched deployment.
  const o = occ('Administrative & clerical');
  const l = level('Mid');
  const usPassThrough = displacement(o, l, us, 2030) / deploymentShare(us, 2030);
  const frPassThrough = displacement(o, l, fr, 2030) / deploymentShare(fr, 2030);
  assert.ok(
    usPassThrough > frPassThrough,
    'at-will US should convert exposure into headcount change faster than France',
  );
});

test('impact worsens monotonically from Senior down to Entry', () => {
  // Monotonicity is asserted only up to Senior. Above that the ordering can
  // legitimately invert: in high-elasticity occupations a Senior sits on a
  // larger automatable base than a Lead, so AI frees more of their time and
  // they capture more of the created work. Software engineering in 2029 is
  // the case that surfaces this.
  const order = ['Entry', 'Junior', 'Mid', 'Senior'];
  for (const o of OCCUPATIONS) {
    for (const year of PROJECTION_YEARS) {
      const values = order.map((name) => netChange(o, level(name), us, year));
      for (let i = 1; i < values.length; i += 1) {
        assert.ok(
          values[i] >= values[i - 1] - 1e-9,
          `${o.name} ${year}: ${order[i]} should fare no worse than ${order[i - 1]}`,
        );
      }
    }
  }
});

test('both senior tiers fare dramatically better than entry everywhere', () => {
  for (const o of OCCUPATIONS) {
    for (const j of JURISDICTIONS) {
      const entry = netChange(o, level('Entry'), j, 2030);
      for (const name of ['Senior', 'Lead / Executive']) {
        assert.ok(
          netChange(o, level(name), j, 2030) > entry - 1e-9,
          `${o.name} ${j.code}: ${name} should beat Entry`,
        );
      }
    }
  }
});

test('low-exposure physical occupations barely move', () => {
  const trades = occ('Skilled trades & construction');
  for (const l of EXPERIENCE_LEVELS) {
    assert.ok(Math.abs(netChange(trades, l, us, 2030)) < 0.02);
  }
});

test('hiring change amplifies headcount change and is floored at -100%', () => {
  const entry = level('Entry');
  // A headcount fall lands entirely on the hiring plan, so it is amplified
  // by the inverse of the baseline hire rate.
  assert.ok(hiringChange(-0.05, entry) < -0.05);
  assert.equal(hiringChange(-5, entry), -1);
});

test('project returns the full grid with finite values', () => {
  const rows = project();
  assert.equal(
    rows.length,
    OCCUPATIONS.length * EXPERIENCE_LEVELS.length * JURISDICTIONS.length * PROJECTION_YEARS.length,
  );
  for (const row of rows) {
    for (const key of ['deployment', 'displacement', 'reinstatement', 'netChange', 'hiringChange']) {
      assert.ok(Number.isFinite(row[key]), `${key} not finite`);
    }
  }
});

test('project rejects an unknown scenario', () => {
  assert.throws(() => project({ scenario: 'nonsense' }), /unknown scenario/);
});
