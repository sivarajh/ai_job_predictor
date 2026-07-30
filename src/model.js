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
  BASE_YEAR,
  ELASTICITY_PASS_THROUGH,
  EXPERIENCE_LEVELS,
  JURISDICTIONS,
  MAX_AUTOMATABLE_SHARE,
  MAX_FRICTION,
  OCCUPATIONS,
  PROJECTION_YEARS,
  REINSTATEMENT_LAG_YEARS,
  REINSTATEMENT_STRENGTH,
  SCENARIOS,
} from './parameters.js';

/**
 * Share of automatable work actually deployed against by `year`.
 *
 * Slow while systems are piloted, steep once they become procurement
 * standard, then a ceiling. A faster scenario pulls the midpoint earlier
 * rather than raising the ceiling implausibly.
 */
export function deploymentShare(jurisdiction, year, scenario = 1) {
  const midpoint = jurisdiction.adoptionMidpoint - (scenario - 1) * 2;
  const raw = 1 / (1 + Math.exp(-jurisdiction.adoptionSteepness * (year - midpoint)));
  return jurisdiction.capacity * raw;
}

/** Share of this cell's tasks AI can perform outright. */
export function automatableShare(occupation, level) {
  return Math.min(
    MAX_AUTOMATABLE_SHARE,
    occupation.exposure * occupation.automationShare * level.substitutionMultiplier,
  );
}

/** Gross reduction in labour demand, as a share of baseline headcount. */
export function displacement(occupation, level, jurisdiction, year, scenario = 1) {
  const friction = MAX_FRICTION * jurisdiction.epl;
  const passThrough = (1 - friction) * level.adjustmentSpeed;
  const pressure = automatableShare(occupation, level) * deploymentShare(jurisdiction, year, scenario);
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
export function freedLabour(occupation, level, jurisdiction, year, scenario = 1) {
  return automatableShare(occupation, level) * deploymentShare(jurisdiction, year, scenario);
}

/**
 * Offsetting labour demand created by the same productivity gain.
 *
 * Lagged: cheaper output, and the new work that follows it, only arrive once
 * the automation has been running for a while.
 */
export function reinstatement(occupation, level, jurisdiction, year, scenario = 1) {
  const freed = freedLabour(occupation, level, jurisdiction, year - REINSTATEMENT_LAG_YEARS, scenario);
  const creationRate =
    occupation.demandElasticity * ELASTICITY_PASS_THROUGH + occupation.newRoleIntensity;
  return freed * creationRate * level.reinstatementShare * jurisdiction.dynamism * REINSTATEMENT_STRENGTH;
}

/** Employment change vs. the no-AI counterfactual, as a fraction. */
export function netChange(occupation, level, jurisdiction, year, scenario = 1) {
  return (
    reinstatement(occupation, level, jurisdiction, year, scenario) -
    displacement(occupation, level, jurisdiction, year, scenario)
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
 * Floored at -1: you cannot hire fewer than nobody.
 */
export function hiringChange(headcountDelta, level) {
  return Math.max(-1, headcountDelta / level.baselineHireRate);
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
} = {}) {
  const multiplier = SCENARIOS[scenario];
  if (multiplier === undefined) {
    throw new Error(`unknown scenario ${scenario}; expected one of ${Object.keys(SCENARIOS).join(', ')}`);
  }

  const rows = [];
  for (const occupation of occupations) {
    for (const level of experienceLevels) {
      for (const jurisdiction of jurisdictions) {
        let previousNet = netChange(occupation, level, jurisdiction, BASE_YEAR, multiplier);
        for (const year of years) {
          const displaced = displacement(occupation, level, jurisdiction, year, multiplier);
          const reinstated = reinstatement(occupation, level, jurisdiction, year, multiplier);
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
            year,
            deployment: deploymentShare(jurisdiction, year, multiplier),
            displacement: displaced,
            reinstatement: reinstated,
            netChange: net,
            employmentIndex: index,
            yoyChange: delta / (1 + previousNet),
            hiringChange: hiringChange(delta, level),
          });
          previousNet = net;
        }
      }
    }
  }
  return rows;
}
