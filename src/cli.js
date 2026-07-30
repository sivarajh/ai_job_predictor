#!/usr/bin/env node
/**
 * Command line entry point. The only module here that touches the filesystem.
 *
 *   node src/cli.js                                   headline tables
 *   node src/cli.js --scenario fast                   faster deployment
 *   node src/cli.js --industry "Public sector"        one sector's timing
 *   node src/cli.js --age 55+                         one age band's recovery
 *   node src/cli.js --jurisdiction Germany --detail   one market, by job type
 *   node src/cli.js --csv outputs/projections.csv     full grid
 *   node src/cli.js --hiring                          openings, not headcount
 *   node src/cli.js --list                            valid industries and bands
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { project } from './model.js';
import { matrixTable, meanBy, toCsv, yearLabel } from './report.js';
import {
  AGE_BANDS,
  EXPERIENCE_LEVELS,
  EXTRAPOLATION_FROM,
  INDUSTRIES,
  JURISDICTIONS,
  OCCUPATIONS,
  PROJECTION_YEARS,
  SCENARIOS,
} from './parameters.js';

const EXPERIENCE_ORDER = EXPERIENCE_LEVELS.map((l) => l.name);
const JURISDICTION_ORDER = JURISDICTIONS.map((j) => j.name);
const OCCUPATION_ORDER = OCCUPATIONS.map((o) => o.name);
const YEAR_LABELS = PROJECTION_YEARS.map((y) => yearLabel(y, EXTRAPOLATION_FROM));

function parseArgs(argv) {
  const args = { scenario: 'central', detail: false, hiring: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--detail') args.detail = true;
    else if (arg === '--hiring') args.hiring = true;
    else if (arg === '--list') args.list = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--')) args[arg.slice(2)] = argv[++i];
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return args;
}

const USAGE = `ai_job_predictor - AI employment impact scenarios, ${PROJECTION_YEARS[0]}-${
  PROJECTION_YEARS[PROJECTION_YEARS.length - 1]
}

  --scenario <${Object.keys(SCENARIOS).join('|')}>   deployment speed (default: central)
  --industry <name>                  sector lens (default: all industries)
  --age <band>                       age band lens (default: all ages)
  --jurisdiction <name>              restrict to one market
  --occupation <name>                restrict to one job type
  --detail                           add job-type breakdowns
  --hiring                           report openings instead of headcount
  --csv <path>                       write the full grid to CSV
  --list                             show valid industry and age band names

† marks years from ${EXTRAPOLATION_FROM} on, which are extrapolation: past the
  last observation the model is only checking itself.
`;

const LISTING = `Industries:
${INDUSTRIES.map((i) => `  ${i.name}`).join('\n')}

Age bands:
${AGE_BANDS.map((a) => `  ${a.name}`).join('\n')}
`;

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (args.list) {
    process.stdout.write(LISTING);
    return 0;
  }

  let rows;
  try {
    rows = project({ scenario: args.scenario, industry: args.industry, ageBand: args.age });
  } catch (error) {
    // An unknown industry or age band is a typo, not a crash - name the
    // valid values rather than making the user go and read the source.
    console.error(`${error.message}\n\n${LISTING}`);
    return 1;
  }

  if (args.csv) {
    mkdirSync(dirname(args.csv), { recursive: true });
    writeFileSync(args.csv, toCsv(rows));
    console.log(`wrote ${rows.length} rows to ${args.csv}\n`);
  }

  let subset = rows;
  let heading = `scenario: ${args.scenario} | industry: ${rows[0].industry} | age: ${rows[0].ageBand}`;
  if (args.jurisdiction) {
    subset = subset.filter((r) => r.jurisdiction === args.jurisdiction);
    heading += ` | jurisdiction: ${args.jurisdiction}`;
  }
  if (args.occupation) {
    subset = subset.filter((r) => r.occupation === args.occupation);
    heading += ` | job type: ${args.occupation}`;
  }
  if (subset.length === 0) {
    console.error('no rows matched that filter');
    return 1;
  }

  const value = args.hiring ? (r) => r.hiringChange : (r) => r.netChange;
  const measure = args.hiring
    ? 'change in annual openings vs. a no-AI counterfactual'
    : 'cumulative headcount change vs. a no-AI counterfactual';

  console.log(heading);
  console.log(`${measure}\n`);

  const present = (list, key) => list.filter((n) => subset.some((r) => r[key] === n));

  console.log(
    matrixTable(subset, {
      rowKey: (r) => r.experience,
      colKey: (r) => yearLabel(r.year, EXTRAPOLATION_FROM),
      rowOrder: EXPERIENCE_ORDER,
      colOrder: YEAR_LABELS,
      label: 'Experience',
      value,
    }),
  );

  console.log();
  console.log(
    matrixTable(subset, {
      rowKey: (r) => r.jurisdiction,
      colKey: (r) => yearLabel(r.year, EXTRAPOLATION_FROM),
      rowOrder: present(JURISDICTION_ORDER, 'jurisdiction'),
      colOrder: YEAR_LABELS,
      label: 'Jurisdiction',
      value,
    }),
  );

  const finalYear = PROJECTION_YEARS[PROJECTION_YEARS.length - 1];
  console.log();
  console.log(
    matrixTable(
      subset.filter((r) => r.year === finalYear),
      {
        rowKey: (r) => r.jurisdiction,
        colKey: (r) => r.experience,
        rowOrder: present(JURISDICTION_ORDER, 'jurisdiction'),
        colOrder: EXPERIENCE_ORDER,
        label: `${finalYear} market x level`,
        value,
      },
    ),
  );

  if (args.detail) {
    console.log();
    console.log(
      matrixTable(subset, {
        rowKey: (r) => r.occupation,
        colKey: (r) => yearLabel(r.year, EXTRAPOLATION_FROM),
        rowOrder: present(OCCUPATION_ORDER, 'occupation'),
        colOrder: YEAR_LABELS,
        label: 'Job type',
        value,
      }),
    );
    console.log();
    console.log(
      matrixTable(
        subset.filter((r) => r.year === finalYear),
        {
          rowKey: (r) => r.occupation,
          colKey: (r) => r.experience,
          rowOrder: present(OCCUPATION_ORDER, 'occupation'),
          colOrder: EXPERIENCE_ORDER,
          label: `${finalYear} job type x level`,
          value,
        },
      ),
    );
  }

  console.log();
  const yoy = meanBy(subset, (r) => r.year, (r) => r.yoyChange);
  console.log(
    'year-on-year headcount change (all cells): ' +
      PROJECTION_YEARS.map((y) => `${y}: ${(yoy.get(JSON.stringify(y)) * 100).toFixed(1)}%`).join('  '),
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
