/**
 * Projection engine.
 *
 * One question per cell of the job type x experience level x jurisdiction x
 * year grid: relative to a no-AI counterfactual, how much bigger or smaller
 * is employment in this cell in this year?
 *
 * Four steps.
 *
 * 1. Automatable share. `exposure x automationShare x experienceMultiplier`
 *    - the share of the cell's work AI does outright rather than assists
 *    with. The automation/augmentation split matters more than raw exposure:
 *    the Stanford/ADP evidence finds employment declines concentrated in
 *    occupations where AI automates, with little effect where it augments.
 *
 * 2. Deployment. Exposure is potential; deployment is what happens. A
 *    logistic curve per jurisdiction, ceiling set by that jurisdiction's
 *    capacity to deploy - infrastructure, capital, skills, regulatory
 *    headroom.
 *
 * 3. Displacement. Deployed automation becomes a headcount change only at
 *    the speed institutions allow. Entry-level adjusts fastest because it
 *    runs through not hiring, which no employment-protection regime
 *    restricts.
 *
 * 4. Reinstatement. A lagged offset from the same productivity gain: cheaper
 *    output raises demand, and new AI-adjacent roles appear. This accrues
 *    unevenly, to senior staff who supervise the systems and to dynamic
 *    labour markets.
 *
 * net = reinstatement - displacement.
 *
 * This module is pure: no I/O, no Node built-ins, so it runs unchanged in a
 * browser. That is what lets the web app compute the real model live rather
 * than replay a precomputed table.
 */

import {
  AGE_BANDS,
  BASE_YEAR,
  ELASTICITY_PASS_THROUGH,
  EXPERIENCE_LEVELS,
  EXTRAPOLATION_FROM,
  INDUSTRIES,
  JURISDICTIONS,
  MAX_AUTOMATABLE_SHARE,
  MAX_FRICTION,
  OCCUPATIONS,
  PROJECTION_YEARS,
  REINSTATEMENT_LAG_YEARS,
  REINSTATEMENT_STRENGTH,
  SCENARIOS,
} from './parameters.js';

const BASELINE_INDUSTRY = INDUSTRIES[0];
const BASELINE_AGE_BAND = AGE_BANDS[0];

/**
 * Normalise the modifier bundle every model function takes.
 *
 * Industry and age arrive as names from the CLI and the web app, and as
 * objects from internal callers. Both resolve here, and anything omitted
 * falls back to the neutral baseline - which is what lets a call with no
 * options reproduce the original cross-sector, all-ages numbers exactly.
 */
export function resolveOptions(options = {}) {
  const { scenario = 1, industry, ageBand } = options;

  const resolved = {
    scenario: typeof scenario === 'string' ? SCENARIOS[scenario] : scenario,
    industry:
      typeof industry === 'string'
        ? INDUSTRIES.find((i) => i.name === industry)
        : industry ?? BASELINE_INDUSTRY,
    ageBand:
      typeof ageBand === 'string'
        ? AGE_BANDS.find((a) => a.name === ageBand)
        : ageBand ?? BASELINE_AGE_BAND,
  };

  if (resolved.scenario === undefined) throw new Error(`unknown scenario ${scenario}`);
  if (!resolved.industry) throw new Error(`unknown industry ${industry}`);
  if (!resolved.ageBand) throw new Error(`unknown age band ${ageBand}`);
  return resolved;
}

/**
 * Share of automatable work actually deployed against by `year`.
 *
 * Slow while systems are piloted, steep once they become procurement
 * standard, then a ceiling. A faster scenario pulls the midpoint earlier
 * rather than raising the ceiling implausibly.
 *
 * Industry moves two things independently: how fast the sector gets there
 * (`adoptionShift`) and how far it is ever allowed to go
 * (`regulatoryCeiling`). Keeping them separate matters - a hospital can be
 * an eager adopter and still be barred from automating a sign-off.
 */
export function deploymentShare(jurisdiction, year, options = {}) {
  const { scenario, industry } = resolveOptions(options);
  const midpoint = jurisdiction.adoptionMidpoint - (scenario - 1) * 2 + industry.adoptionShift;
  const raw = 1 / (1 + Math.exp(-jurisdiction.adoptionSteepness * (year - midpoint)));
  return jurisdiction.capacity * industry.regulatoryCeiling * raw;
}

/** Share of this cell's tasks AI can perform outright. */
export function automatableShare(occupation, level) {
  return Math.min(
    MAX_AUTOMATABLE_SHARE,
    occupation.exposure * occupation.automationShare * level.substitutionMultiplier,
  );
}

/**
 * Gross reduction in labour demand, as a share of baseline headcount.
 *
 * Age deliberately does not appear here. How much work AI takes, and how
 * fast the employer can act on it, depend on the role and the jurisdiction -
 * not on the birthday of whoever currently holds the job. Age acts on what
 * happens to the worker afterwards, which is reinstatement and hiring.
 */
export function displacement(occupation, level, jurisdiction, year, options = {}) {
  const friction = MAX_FRICTION * jurisdiction.epl;
  const passThrough = (1 - friction) * level.adjustmentSpeed;
  const pressure = automatableShare(occupation, level) * deploymentShare(jurisdiction, year, options);
  return pressure * passThrough * jurisdiction.demographicPressure;
}

/**
 * Labour freed by automation that is actually running, before any
 * institutional damping.
 *
 * Deliberately not a function of employment protection or adjustment speed.
 * The productivity gain exists once the automation runs, whether or not the
 * firm was legally able to act on it - a German employer who cannot dismiss
 * anyone still gets the cheaper output. Gating creation on dismissal law, as
 * an earlier version of this model did, wrongly made strict-protection
 * markets look like they generate less new work.
 */
export function freedLabour(occupation, level, jurisdiction, year, options = {}) {
  return automatableShare(occupation, level) * deploymentShare(jurisdiction, year, options);
}

/**
 * Offsetting labour demand created by the same productivity gain.
 *
 * Lagged: cheaper output, and the new work that follows it, only arrive once
 * the automation has been running for a while.
 *
 * This is where both new modifiers land. Industry sets whether the sector is
 * growing or shrinking around the AI effect; age sets how much of the new
 * work this cohort actually captures, since re-employment after displacement
 * falls with age.
 */
export function reinstatement(occupation, level, jurisdiction, year, options = {}) {
  const { industry, ageBand } = resolveOptions(options);
  const freed = freedLabour(occupation, level, jurisdiction, year - REINSTATEMENT_LAG_YEARS, options);
  const creationRate =
    occupation.demandElasticity * ELASTICITY_PASS_THROUGH + occupation.newRoleIntensity;
  return (
    freed *
    creationRate *
    level.reinstatementShare *
    jurisdiction.dynamism *
    REINSTATEMENT_STRENGTH *
    industry.demandTrend *
    ageBand.reinstatementMultiplier
  );
}

/** Employment change vs. the no-AI counterfactual, as a fraction. */
export function netChange(occupation, level, jurisdiction, year, options = {}) {
  return (
    reinstatement(occupation, level, jurisdiction, year, options) -
    displacement(occupation, level, jurisdiction, year, options)
  );
}

/**
 * Change in annual openings vs. the counterfactual, as a fraction.
 *
 * A level that needs to shrink does so by not replacing leavers, so the
 * whole of a headcount decline lands on the hiring plan. Dividing the
 * year-on-year headcount delta by the baseline hire rate is why a modest
 * headcount effect shows up as a severe collapse in openings - and why the
 * entry level, which has both the largest headcount effect and the highest
 * baseline hire rate, is where the damage becomes visible first.
 *
 * Age acts here as an amplifier of the AI effect, not as a level shift.
 * Older applicants absorb more of the downside and capture less of the
 * upside. It is written this way so that a cohort with no AI effect shows no
 * age effect either: age bias in hiring exists in the no-AI counterfactual
 * too, and this model measures the difference from that counterfactual, not
 * the absolute state of the labour market.
 *
 * Floored at -1: you cannot hire fewer than nobody.
 */
export function hiringChange(headcountDelta, level, options = {}) {
  const { ageBand } = resolveOptions(options);
  const raw = headcountDelta / level.baselineHireRate;
  const aged = raw < 0 ? raw / ageBand.hiringMultiplier : raw * ageBand.hiringMultiplier;
  return Math.max(-1, aged);
}

/**
 * Run the full grid. Returns one row per cell-year.
 */
export function project({
  occupations = OCCUPATIONS,
  experienceLevels = EXPERIENCE_LEVELS,
  jurisdictions = JURISDICTIONS,
  years = PROJECTION_YEARS,
  scenario = 'central',
  industry,
  ageBand,
} = {}) {
  if (typeof scenario === 'string' && SCENARIOS[scenario] === undefined) {
    throw new Error(`unknown scenario ${scenario}; expected one of ${Object.keys(SCENARIOS).join(', ')}`);
  }
  const options = resolveOptions({ scenario, industry, ageBand });

  const rows = [];
  for (const occupation of occupations) {
    for (const level of experienceLevels) {
      for (const jurisdiction of jurisdictions) {
        let previousNet = netChange(occupation, level, jurisdiction, BASE_YEAR, options);
        for (const year of years) {
          const displaced = displacement(occupation, level, jurisdiction, year, options);
          const reinstated = reinstatement(occupation, level, jurisdiction, year, options);
          const net = reinstated - displaced;
          const index = 100 * (1 + net);

          // Year-on-year headcount delta, in points of baseline headcount.
          const delta = net - previousNet;

          rows.push({
            occupation: occupation.name,
            group: occupation.group,
            experience: level.name,
            jurisdiction: jurisdiction.name,
            code: jurisdiction.code,
            industry: options.industry.name,
            ageBand: options.ageBand.name,
            year,
            extrapolated: year >= EXTRAPOLATION_FROM,
            deployment: deploymentShare(jurisdiction, year, options),
            displacement: displaced,
            reinstatement: reinstated,
            netChange: net,
            employmentIndex: index,
            yoyChange: delta / (1 + previousNet),
            hiringChange: hiringChange(delta, level, options),
          });
          previousNet = net;
        }
      }
    }
  }
  return rows;
}
