/**
 * Industry and age-band modifier behaviour.
 *
 * These assert the *ordering and mechanism* the modifiers are supposed to
 * encode, not specific magnitudes — the magnitudes are estimates, and a test
 * that pinned them would only be asserting that the parameter file has not
 * been edited.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { deploymentShare, hiringChange, netChange, project, reinstatement } from '../src/model.js';
import {
  AGE_BANDS,
  EXPERIENCE_LEVELS,
  EXTRAPOLATION_FROM,
  INDUSTRIES,
  JURISDICTIONS,
  OCCUPATIONS,
  PROJECTION_YEARS,
} from '../src/parameters.js';

const us = JURISDICTIONS.find((j) => j.name === 'United States');
const level = (name) => EXPERIENCE_LEVELS.find((l) => l.name === name);
const occ = (name) => OCCUPATIONS.find((o) => o.name === name);
const industry = (name) => INDUSTRIES.find((i) => i.name === name);

// ---------------------------------------------------------------- industry

test('fast sectors deploy earlier than slow ones', () => {
  for (const year of PROJECTION_YEARS) {
    assert.ok(
      deploymentShare(us, year, { industry: 'Technology' }) >
        deploymentShare(us, year, { industry: 'Public sector' }),
      `Technology should lead Public sector in ${year}`,
    );
  }
});

test('regulated sectors reach a lower ceiling however long you wait', () => {
  // Timing differences wash out in the long run; a ceiling does not. This is
  // why adoptionShift and regulatoryCeiling are separate levers.
  const farFuture = 2100;
  for (const name of ['Healthcare', 'Financial services', 'Public sector']) {
    assert.ok(
      deploymentShare(us, farFuture, { industry: name }) <
        deploymentShare(us, farFuture, { industry: 'Technology' }),
      `${name} should saturate below Technology`,
    );
  }
});

test('the baseline industry is exactly neutral on deployment', () => {
  for (const year of PROJECTION_YEARS) {
    assert.equal(
      deploymentShare(us, year, { industry: 'All industries (baseline)' }),
      deploymentShare(us, year),
    );
  }
});

test('a growing sector creates more replacement work than a shrinking one', () => {
  const args = [occ('Marketing & content'), level('Mid'), us, 2032];
  assert.ok(industry('Technology').demandTrend > industry('Media').demandTrend);
  assert.ok(
    reinstatement(...args, { industry: 'Technology' }) >
      reinstatement(...args, { industry: 'Media' }),
  );
});

test('slow sectors converge on fast ones by the end of the horizon', () => {
  // Institutions delay the effect; they do not cancel it. The gap at 2036
  // should be a fraction of the gap at 2027.
  const args = [occ('Administrative & clerical'), level('Entry'), us];
  const gap = (year) =>
    Math.abs(
      netChange(...args, year, { industry: 'Technology' }) -
        netChange(...args, year, { industry: 'Public sector' }),
    );
  assert.ok(gap(2036) < gap(2027), 'the sector gap should narrow, not widen');
});

// --------------------------------------------------------------- age bands

test('older bands capture less of the newly created work', () => {
  const args = [occ('Software engineering'), level('Mid'), us, 2032];
  const byBand = AGE_BANDS.filter((b) => b.name !== 'All ages').map((b) => ({
    name: b.name,
    value: reinstatement(...args, { ageBand: b.name }),
  }));
  // AGE_BANDS is ordered youngest to oldest; recovery must not increase.
  for (let i = 1; i < byBand.length; i += 1) {
    assert.ok(
      byBand[i].value <= byBand[i - 1].value + 1e-12,
      `${byBand[i].name} should not recover better than ${byBand[i - 1].name}`,
    );
  }
});

test('age does not change how much work is displaced', () => {
  // Age acts on what happens to the worker afterwards, not on how automatable
  // the role is. Displacement must be identical across bands.
  const rows = (band) =>
    project({ ageBand: band, years: [2030] }).map((r) => r.displacement);
  assert.deepEqual(rows('55+'), rows('22-25'));
});

test('age amplifies the downside and damps the upside in hiring', () => {
  const entry = level('Entry');
  const older = { ageBand: '55+' };
  const younger = { ageBand: '26-34' };

  const loss = -0.05;
  assert.ok(hiringChange(loss, entry, older) < hiringChange(loss, entry, younger));

  const gain = 0.05;
  assert.ok(hiringChange(gain, entry, older) < hiringChange(gain, entry, younger));
});

test('a cell with no AI effect shows no age effect', () => {
  // The counterfactual already contains age bias in hiring; this model
  // reports the difference from that counterfactual, so zero maps to zero.
  for (const band of AGE_BANDS) {
    assert.equal(hiringChange(0, level('Mid'), { ageBand: band.name }), 0);
  }
});

// ------------------------------------------------------------------ safety

test('unknown industry or age band fails loudly', () => {
  assert.throws(() => project({ industry: 'Banking' }), /unknown industry/);
  assert.throws(() => project({ ageBand: '18-21' }), /unknown age band/);
});

test('no combination produces an implausible value', () => {
  // The long horizon lets reinstatement accrue for a decade; this guards
  // against a cell drifting somewhere absurd out at 2036.
  for (const scenario of ['slow', 'central', 'fast']) {
    for (const ind of INDUSTRIES) {
      for (const band of AGE_BANDS) {
        for (const row of project({ scenario, industry: ind.name, ageBand: band.name })) {
          assert.ok(
            row.netChange > -0.95 && row.netChange < 0.6,
            `${row.occupation}/${row.experience}/${row.jurisdiction}/${row.year} ` +
              `${ind.name}/${band.name}/${scenario} = ${row.netChange}`,
          );
          assert.ok(row.hiringChange >= -1 && row.hiringChange < 2);
        }
      }
    }
  }
});

test('rows carry their industry, age band and extrapolation flag', () => {
  const rows = project({ industry: 'Healthcare', ageBand: '45-54' });
  assert.ok(rows.every((r) => r.industry === 'Healthcare'));
  assert.ok(rows.every((r) => r.ageBand === '45-54'));
  assert.ok(rows.every((r) => r.extrapolated === r.year >= EXTRAPOLATION_FROM));
  assert.ok(rows.some((r) => r.extrapolated) && rows.some((r) => !r.extrapolated));
});
