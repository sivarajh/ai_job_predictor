/**
 * Baseline neutrality.
 *
 * Industry and age bands were added as modifier layers rather than as stored
 * grid dimensions. The property that makes that claim true is this one: with
 * the baseline industry and the baseline age band selected, the model must
 * return exactly what it returned before either existed.
 *
 * The fixture was captured from the model as it stood before those changes.
 * If this test fails, the new dimensions have quietly altered the
 * cross-sector, all-ages result rather than sitting on top of it — which
 * would also invalidate the calibration, since that is fitted at baseline.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { project } from '../src/model.js';
import { EXPERIENCE_LEVELS, JURISDICTIONS, OCCUPATIONS, PROJECTION_YEARS } from '../src/parameters.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures/baseline-2026-2030.json'), 'utf8'));

test('the fixture still describes the grid it was captured from', () => {
  // A reordered or resized dimension would silently misalign the flat value
  // array, so check the shape before comparing any numbers.
  assert.deepEqual(OCCUPATIONS.map((o) => o.name), fixture.occupations);
  assert.deepEqual(EXPERIENCE_LEVELS.map((l) => l.name), fixture.experienceLevels);
  assert.deepEqual(JURISDICTIONS.map((j) => j.name), fixture.jurisdictions);
});

test('baseline industry and age reproduce the pre-change numbers exactly', () => {
  const rows = project({ years: fixture.years });
  assert.equal(rows.length, fixture.netChange.length);

  rows.forEach((row, i) => {
    // The fixture stores 8 decimal places, so compare at that precision
    // rather than demanding bit equality against a rounded value.
    assert.equal(
      Number(row.netChange.toFixed(8)),
      fixture.netChange[i],
      `${row.occupation} / ${row.experience} / ${row.jurisdiction} / ${row.year} drifted from baseline`,
    );
  });
});

test('explicitly selecting the baseline options changes nothing', () => {
  const implicit = project({ years: fixture.years });
  const explicit = project({
    years: fixture.years,
    industry: 'All industries (baseline)',
    ageBand: 'All ages',
  });
  assert.deepEqual(
    explicit.map((r) => r.netChange),
    implicit.map((r) => r.netChange),
  );
});

test('the extended horizon left the original years untouched', () => {
  // Extending to 2036 must not have shifted 2026-2030 by so much as a digit.
  const full = project();
  const originalYears = new Set(fixture.years);
  const overlap = full.filter((r) => originalYears.has(r.year));
  assert.equal(overlap.length, fixture.netChange.length);
  overlap.forEach((row, i) => {
    assert.equal(Number(row.netChange.toFixed(8)), fixture.netChange[i]);
  });
});

test('PROJECTION_YEARS spans 2026 to 2036 with no gaps', () => {
  assert.equal(PROJECTION_YEARS[0], 2026);
  assert.equal(PROJECTION_YEARS[PROJECTION_YEARS.length - 1], 2036);
  assert.equal(PROJECTION_YEARS.length, 11);
  PROJECTION_YEARS.forEach((year, i) => {
    if (i > 0) assert.equal(year - PROJECTION_YEARS[i - 1], 1);
  });
});
