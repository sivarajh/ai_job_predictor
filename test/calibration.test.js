/**
 * The model's central claim - that AI's employment effect falls hardest on
 * the entry level while experienced staff hold steady - is fitted to
 * observed data rather than assumed. These tests assert the fit still holds,
 * so that a parameter edit cannot silently break it.
 *
 * Target: Brynjolfsson, Chandar & Chen (2025), ADP payroll microdata.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { netChange } from '../src/model.js';
import {
  CALIBRATION_TARGETS as TARGETS,
  EXPERIENCE_LEVELS,
  JURISDICTIONS,
  OCCUPATIONS,
} from '../src/parameters.js';

const jurisdiction = JURISDICTIONS.find((j) => j.name === TARGETS.jurisdiction);
const occupations = TARGETS.occupations.map((name) => OCCUPATIONS.find((o) => o.name === name));
const level = (name) => EXPERIENCE_LEVELS.find((l) => l.name === name);

function meanNetChange(levelName, options = {}) {
  const values = occupations.map((o) =>
    netChange(o, level(levelName), jurisdiction, TARGETS.year, options),
  );
  return values.reduce((a, b) => a + b, 0) / values.length;
}

test('parameters referenced by the calibration targets all resolve', () => {
  assert.ok(jurisdiction, `missing jurisdiction ${TARGETS.jurisdiction}`);
  assert.equal(occupations.filter(Boolean).length, TARGETS.occupations.length);
});

test('entry level reproduces the observed ~16% relative decline', () => {
  const actual = meanNetChange('Entry');
  const { min, max } = TARGETS.entryHeadcountChange;
  assert.ok(
    actual >= min && actual <= max,
    `entry-level ${TARGETS.year} change ${(actual * 100).toFixed(1)}% outside observed band ` +
      `${(min * 100).toFixed(0)}%..${(max * 100).toFixed(0)}%`,
  );
});

test('experienced workers stay approximately stable', () => {
  const actual = meanNetChange('Mid');
  const { min, max } = TARGETS.midHeadcountChange;
  assert.ok(
    actual >= min && actual <= max,
    `mid-level ${TARGETS.year} change ${(actual * 100).toFixed(1)}% outside observed band ` +
      `${(min * 100).toFixed(0)}%..${(max * 100).toFixed(0)}%`,
  );
});

test('the target holds on the age axis the paper actually measured', () => {
  // The published finding is about workers aged 22-25. Before age bands
  // existed this could only be proxied through the Entry experience level;
  // now it can be checked directly, and both readings must land in the band.
  const actual = meanNetChange('Entry', { ageBand: TARGETS.ageBand });
  const { min, max } = TARGETS.ageBandHeadcountChange;
  assert.ok(
    actual >= min && actual <= max,
    `${TARGETS.ageBand} at entry level: ${(actual * 100).toFixed(1)}% outside observed band ` +
      `${(min * 100).toFixed(0)}%..${(max * 100).toFixed(0)}%`,
  );
});

test('the entry-level effect is several times the mid-career effect', () => {
  // The qualitative shape of the finding, independent of the exact band.
  assert.ok(meanNetChange('Entry') < meanNetChange('Mid') * 3);
});

test('automation-heavy occupations decline more than augmentation-heavy ones', () => {
  // The paper's key discriminator: effects concentrate where AI automates.
  const support = OCCUPATIONS.find((o) => o.name === 'Customer support & call centre');
  const consulting = OCCUPATIONS.find((o) => o.name === 'Management consulting');
  assert.ok(support.automationShare > consulting.automationShare);
  assert.ok(
    netChange(support, level('Entry'), jurisdiction, TARGETS.year) <
      netChange(consulting, level('Entry'), jurisdiction, TARGETS.year),
  );
});
