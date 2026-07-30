/**
 * Aggregation and rendering of projection results.
 *
 * Like model.js this is pure - it returns strings and objects and never
 * touches the filesystem, so the browser build can reuse it.
 */

export const CSV_FIELDS = [
  'year',
  'extrapolated',
  'jurisdiction',
  'code',
  'occupation',
  'group',
  'experience',
  'industry',
  'ageBand',
  'deployment',
  'displacement',
  'reinstatement',
  'netChange',
  'employmentIndex',
  'yoyChange',
  'hiringChange',
];

/** Serialise rows to CSV. Numbers rounded to 5dp to keep diffs readable. */
export function toCsv(rows, fields = CSV_FIELDS) {
  const lines = [fields.join(',')];
  for (const row of rows) {
    lines.push(
      fields
        .map((field) => {
          const value = row[field];
          return typeof value === 'number' ? Number(value.toFixed(5)) : value;
        })
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}

/**
 * Unweighted mean of `value` grouped by `key`.
 *
 * Unweighted because the model carries no headcount weights: every job type
 * counts once. Read aggregates as "the average job type in this cell", not
 * "the labour force of this jurisdiction".
 */
export function meanBy(rows, key, value = (r) => r.netChange) {
  const buckets = new Map();
  for (const row of rows) {
    const k = JSON.stringify(key(row));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(value(row));
  }
  const out = new Map();
  for (const [k, values] of buckets) {
    out.set(k, values.reduce((a, b) => a + b, 0) / values.length);
  }
  return out;
}

const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;

/**
 * Render a row-key x column-key table of means as fixed-width text.
 */
export function matrixTable(rows, { rowKey, colKey, rowOrder, colOrder, label = '', value }) {
  const means = meanBy(rows, (r) => [rowKey(r), colKey(r)], value);
  const rowNames = rowOrder ?? [...new Set(rows.map(rowKey))];
  const colNames = colOrder ?? [...new Set(rows.map(colKey))];

  const width = Math.max(label.length, ...rowNames.map((r) => String(r).length)) + 2;
  // Each column is at least 10 wide, but widens for long headings such as
  // "Lead / Executive" so values stay under their own label.
  const colWidths = colNames.map((c) => Math.max(10, String(c).length + 2));

  const header = label.padEnd(width) + colNames.map((c, i) => String(c).padStart(colWidths[i])).join('');
  const lines = [header, '-'.repeat(header.length)];

  for (const r of rowNames) {
    let line = String(r).padEnd(width);
    colNames.forEach((c, i) => {
      const v = means.get(JSON.stringify([r, c]));
      line += (v === undefined ? '-' : pct(v)).padStart(colWidths[i]);
    });
    lines.push(line);
  }
  return lines.join('\n');
}

/**
 * Workforce-planning rollup: for a given org shape, the net headcount change
 * implied per function and level.
 *
 * `orgShape` maps job type -> { level: headcount }. Returns absolute people,
 * not percentages, because a hiring plan is denominated in people.
 */
export function orgImpact(rows, orgShape, year) {
  const byCell = new Map();
  for (const row of rows) {
    if (row.year !== year) continue;
    byCell.set(`${row.occupation}|${row.experience}`, row);
  }

  const results = [];
  let totalBaseline = 0;
  let totalDelta = 0;

  for (const [occupation, levels] of Object.entries(orgShape)) {
    for (const [experience, headcount] of Object.entries(levels)) {
      const row = byCell.get(`${occupation}|${experience}`);
      if (!row) continue;
      const delta = headcount * row.netChange;
      results.push({
        occupation,
        experience,
        baseline: headcount,
        projected: headcount + delta,
        delta,
        netChange: row.netChange,
        hiringChange: row.hiringChange,
      });
      totalBaseline += headcount;
      totalDelta += delta;
    }
  }

  return {
    year,
    lines: results.sort((a, b) => a.delta - b.delta),
    totalBaseline,
    totalDelta,
    totalChange: totalBaseline ? totalDelta / totalBaseline : 0,
  };
}

/**
 * Mark a year heading as extrapolated.
 *
 * A bare number invites a 2036 figure to be read with the same confidence as
 * a 2027 one. The dagger is the cheapest way to keep that distinction on
 * screen in plain text; the charts shade the same region.
 */
export function yearLabel(year, extrapolationFrom) {
  return year >= extrapolationFrom ? `${year}†` : String(year);
}

/** Cells with the largest projected decline, worst first. */
export function mostExposedCells(rows, year, limit = 10) {
  return rows
    .filter((r) => r.year === year)
    .sort((a, b) => a.netChange - b.netChange)
    .slice(0, limit);
}
