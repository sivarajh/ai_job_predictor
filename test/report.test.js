import test from 'node:test';
import assert from 'node:assert/strict';

import { project } from '../src/model.js';
import { CSV_FIELDS, matrixTable, meanBy, mostExposedCells, orgImpact, toCsv } from '../src/report.js';
import { PROJECTION_YEARS } from '../src/parameters.js';

const rows = project();

test('CSV round-trips row count and headers', () => {
  const csv = toCsv(rows);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], CSV_FIELDS.join(','));
  assert.equal(lines.length - 1, rows.length);
});

test('CSV values parse back to the original numbers within rounding', () => {
  const sample = rows.slice(0, 50);
  const lines = toCsv(sample).trim().split('\n').slice(1);
  lines.forEach((line, i) => {
    const values = line.split(',');
    const netIndex = CSV_FIELDS.indexOf('netChange');
    assert.ok(Math.abs(Number(values[netIndex]) - sample[i].netChange) < 1e-5);
  });
});

test('meanBy averages within groups', () => {
  const means = meanBy(
    [{ netChange: 0.2 }, { netChange: 0.4 }],
    () => 'all',
  );
  assert.equal(means.get(JSON.stringify('all')), 0.30000000000000004);
});

test('matrixTable aligns columns wider than their heading', () => {
  const table = matrixTable(rows, {
    rowKey: (r) => r.jurisdiction,
    colKey: (r) => r.experience,
    label: 'Market',
  });
  const lines = table.split('\n');
  // Every rendered line is the same width as the header rule.
  const ruleWidth = lines[1].length;
  for (const line of [lines[0], ...lines.slice(2)]) {
    assert.equal(line.length, ruleWidth, `misaligned row: ${line}`);
  }
});

test('orgImpact scales percentages into people and totals them', () => {
  const shape = {
    'Software engineering': { Entry: 100, Senior: 50 },
    'Customer support & call centre': { Entry: 200 },
  };
  const result = orgImpact(
    rows.filter((r) => r.jurisdiction === 'United States'),
    shape,
    2030,
  );
  assert.equal(result.totalBaseline, 350);
  assert.equal(result.lines.length, 3);
  // Worst-hit cell sorts first.
  assert.equal(result.lines[0].occupation, 'Customer support & call centre');
  assert.ok(result.totalDelta < 0);
  assert.ok(Math.abs(result.totalChange - result.totalDelta / 350) < 1e-12);
});

test('orgImpact ignores job types absent from the model', () => {
  const result = orgImpact(rows, { 'Astronaut': { Entry: 10 } }, 2030);
  assert.equal(result.lines.length, 0);
  assert.equal(result.totalBaseline, 0);
  assert.equal(result.totalChange, 0);
});

test('mostExposedCells returns the worst cells for the year, worst first', () => {
  const year = PROJECTION_YEARS[PROJECTION_YEARS.length - 1];
  const worst = mostExposedCells(rows, year, 5);
  assert.equal(worst.length, 5);
  assert.ok(worst.every((r) => r.year === year));
  for (let i = 1; i < worst.length; i += 1) {
    assert.ok(worst[i - 1].netChange <= worst[i].netChange);
  }
  assert.equal(worst[0].experience, 'Entry');
});
