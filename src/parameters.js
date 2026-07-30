/**
 * Parameter tables for the AI job-impact projection model.
 *
 * Every number here is a modelling assumption. Where a published source
 * exists it is cited inline and the mapping from the source's scale to the
 * model's scale is stated. Where no source exists the value is marked
 * ESTIMATE. Nothing here is an observation of the future.
 *
 * Sources
 * -------
 * ILO WP140 (May 2025), "Generative AI and Jobs: A Refined Global Index of
 *   Occupational Exposure". ~30k tasks, ~50k human assessments, ISCO-08.
 *   Findings used: clerical occupations carry the highest exposure, with
 *   data-entry, payroll and typing tasks showing the highest automation
 *   potential; 3.3% of global employment sits in the top gradient; roughly
 *   one in four workers worldwide (one in three in high-income countries)
 *   is in an occupation with some exposure; the 2025 revision lowered many
 *   task scores versus 2023 but *raised* exposure for strongly digitised
 *   professional and technical roles.
 *   https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure
 *
 * Brynjolfsson, Chandar & Chen (2025), "Canaries in the Coal Mine? Six Facts
 *   about the Recent Employment Effects of Artificial Intelligence".
 *   Stanford Digital Economy Lab, ADP payroll microdata, dashboard extended
 *   to April 2026. Findings used: ~16% relative employment decline for ages
 *   22-25 in the most AI-exposed occupations controlling for firm-level
 *   shocks, while employment for experienced workers in the same
 *   occupations held stable; adjustment runs through employment rather than
 *   compensation; declines concentrate where AI *automates* rather than
 *   *augments*. These are the model's calibration targets - see
 *   CALIBRATION_TARGETS below.
 *   https://digitaleconomy.stanford.edu/publication/canaries-in-the-coal-mine-six-facts-about-the-recent-employment-effects-of-artificial-intelligence/
 *
 * IMF AI Preparedness Index (2024), 174 economies, four pillars: digital
 *   infrastructure, human capital and labour-market policy, innovation and
 *   economic integration, regulation and ethics. Published anchor points:
 *   Singapore 0.80, Denmark 0.78, United States 0.77, China 0.63,
 *   India 0.49. https://www.imf.org/external/datamapper/datasets/AIPI
 *
 * OECD Indicators of Employment Protection, EPRC v4 (regular contracts,
 *   individual and collective dismissal), 0-6 least-to-most strict.
 *   Common-law countries rank in the lower half; France ~2.8 is among the
 *   strictest. https://www.oecd.org/en/data/datasets/oecd-indicators-of-employment-protection.html
 *
 * EU AI Act: Annex III high-risk obligations deferred from 2 August 2026 to
 *   2 December 2027 under the Digital Omnibus agreement of May 2026, which
 *   *reduces* near-term regulatory drag on EU deployment relative to the
 *   original timetable.
 *
 * A note on how these were obtained: this environment's network policy
 * permits search but not direct document retrieval, so the per-country
 * index values below were reconstructed from published summary figures
 * rather than downloaded from the source datasets. Anchor points quoted in
 * the sources above are exact; the remaining country values are
 * interpolations and are marked ESTIMATE. Re-derive them from the raw
 * datasets before using this for anything that matters.
 */

/**
 * Job types.
 *
 * `exposure` - share of the occupation's tasks materially exposed to
 * current-generation AI, following the ILO index construction.
 *
 * `automationShare` - of those exposed tasks, the share where AI substitutes
 * for the worker rather than assisting them. This is the ILO
 * automation/augmentation distinction, and per the Stanford paper it is the
 * variable that actually predicts employment effects: occupations where AI
 * augments show little or no employment decline.
 *
 * `demandElasticity` - how strongly cheaper output raises demand for the
 * occupation's output. Software has famously elastic demand; payroll
 * processing does not. ESTIMATE throughout.
 *
 * `newRoleIntensity` - propensity of the field to generate genuinely new
 * AI-adjacent work. ESTIMATE throughout.
 */
export const OCCUPATIONS = [
  // ISCO-08 major group 4 - clerical support. Highest exposure in the ILO
  // index, and the highest automation potential within that exposure.
  { name: 'Administrative & clerical', group: 'Business services', isco: '4', exposure: 0.78, automationShare: 0.70, demandElasticity: 0.15, newRoleIntensity: 0.08 },
  { name: 'Customer support & call centre', group: 'Business services', isco: '42', exposure: 0.75, automationShare: 0.68, demandElasticity: 0.20, newRoleIntensity: 0.10 },
  { name: 'Accounting & bookkeeping', group: 'Finance', isco: '431', exposure: 0.70, automationShare: 0.62, demandElasticity: 0.25, newRoleIntensity: 0.12 },

  // ISCO-08 group 2/3 - language-native professional work. The 2025 ILO
  // revision raised exposure for strongly digitised professional roles.
  { name: 'Translation & localisation', group: 'Media & creative', isco: '2643', exposure: 0.80, automationShare: 0.72, demandElasticity: 0.30, newRoleIntensity: 0.08 },
  { name: 'Marketing & content', group: 'Media & creative', isco: '2431', exposure: 0.70, automationShare: 0.50, demandElasticity: 0.55, newRoleIntensity: 0.25 },
  { name: 'Paralegal & legal support', group: 'Legal', isco: '3411', exposure: 0.68, automationShare: 0.55, demandElasticity: 0.35, newRoleIntensity: 0.15 },
  { name: 'Journalism & editorial', group: 'Media & creative', isco: '2642', exposure: 0.66, automationShare: 0.48, demandElasticity: 0.25, newRoleIntensity: 0.12 },
  { name: 'Graphic & visual design', group: 'Media & creative', isco: '2166', exposure: 0.62, automationShare: 0.52, demandElasticity: 0.45, newRoleIntensity: 0.18 },

  // Technology. High exposure, but high demand elasticity and high new-role
  // intensity - the offset is larger here than anywhere else.
  { name: 'Software engineering', group: 'Technology', isco: '2512', exposure: 0.65, automationShare: 0.46, demandElasticity: 0.85, newRoleIntensity: 0.35 },
  { name: 'Data analysis & BI', group: 'Technology', isco: '2511', exposure: 0.66, automationShare: 0.42, demandElasticity: 0.75, newRoleIntensity: 0.30 },
  { name: 'IT support & operations', group: 'Technology', isco: '351', exposure: 0.60, automationShare: 0.48, demandElasticity: 0.40, newRoleIntensity: 0.20 },

  // Judgement- and accountability-heavy professional work. Exposed, but
  // mostly on the augmentation side.
  { name: 'Financial analysis', group: 'Finance', isco: '2413', exposure: 0.60, automationShare: 0.38, demandElasticity: 0.45, newRoleIntensity: 0.22 },
  { name: 'HR & recruiting', group: 'Business services', isco: '2423', exposure: 0.56, automationShare: 0.42, demandElasticity: 0.25, newRoleIntensity: 0.15 },
  { name: 'Management consulting', group: 'Business services', isco: '2421', exposure: 0.55, automationShare: 0.32, demandElasticity: 0.45, newRoleIntensity: 0.22 },
  { name: 'Sales (inside / B2B)', group: 'Business services', isco: '243', exposure: 0.52, automationShare: 0.35, demandElasticity: 0.50, newRoleIntensity: 0.20 },
  { name: 'Lawyers (qualified)', group: 'Legal', isco: '2611', exposure: 0.52, automationShare: 0.28, demandElasticity: 0.40, newRoleIntensity: 0.18 },
  { name: 'Radiology & diagnostics', group: 'Healthcare', isco: '2212', exposure: 0.48, automationShare: 0.20, demandElasticity: 0.60, newRoleIntensity: 0.15 },

  // Physical, in-person and custodial work. Low genAI exposure - note this
  // model does not cover robotics, which is where any threat to these
  // occupations would come from.
  { name: 'Teaching (K-12)', group: 'Education', isco: '23', exposure: 0.32, automationShare: 0.10, demandElasticity: 0.30, newRoleIntensity: 0.10 },
  { name: 'Warehouse & logistics ops', group: 'Operations', isco: '93', exposure: 0.20, automationShare: 0.15, demandElasticity: 0.40, newRoleIntensity: 0.06 },
  { name: 'Nursing & direct care', group: 'Healthcare', isco: '2221', exposure: 0.16, automationShare: 0.05, demandElasticity: 0.55, newRoleIntensity: 0.08 },
  { name: 'Skilled trades & construction', group: 'Operations', isco: '7', exposure: 0.09, automationShare: 0.03, demandElasticity: 0.50, newRoleIntensity: 0.05 },
];

/**
 * Experience levels.
 *
 * The central asymmetry of the model, and the part calibrated against
 * observed data rather than assumed: AI is strongest at the codified,
 * reviewable, well-specified work junior staff are hired to do, and weakest
 * at the accountability and judgement under ambiguity that seniority is paid
 * for. Senior staff also capture most of the new supervisory and
 * AI-orchestration work created.
 *
 * `substitutionMultiplier` and `reinstatementShare` are fitted so the model
 * reproduces the Stanford/ADP result - see CALIBRATION_TARGETS and
 * test/calibration.test.js.
 *
 * `adjustmentSpeed` encodes the mechanism the Stanford paper identifies, and
 * it falls steeply with seniority for a reason. Entry-level adjustment runs
 * through the *hiring* channel - no notice period, no severance, no works
 * council - so it is the fastest channel in every jurisdiction. Incumbent
 * senior staff can only be adjusted by dismissal, which is slow and
 * expensive everywhere. This gradient, not the substitution gradient, is
 * what reproduces the observed pattern of a collapsing junior tier
 * alongside a stable experienced one.
 *
 * `baselineHireRate` - gross annual hires as a share of headcount at this
 * level absent AI. Used to translate a headcount change into an openings
 * change: a shrinking level is achieved by not replacing leavers, so a small
 * headcount effect becomes a large hiring effect. ESTIMATE.
 */
export const EXPERIENCE_LEVELS = [
  { name: 'Entry', years: '0-2 yrs', substitutionMultiplier: 1.28, adjustmentSpeed: 1.30, reinstatementShare: 0.40, baselineHireRate: 0.35 },
  { name: 'Junior', years: '2-5 yrs', substitutionMultiplier: 1.10, adjustmentSpeed: 0.80, reinstatementShare: 0.70, baselineHireRate: 0.24 },
  { name: 'Mid', years: '5-10 yrs', substitutionMultiplier: 0.80, adjustmentSpeed: 0.42, reinstatementShare: 1.10, baselineHireRate: 0.16 },
  { name: 'Senior', years: '10-20 yrs', substitutionMultiplier: 0.55, adjustmentSpeed: 0.28, reinstatementShare: 1.35, baselineHireRate: 0.11 },
  { name: 'Lead / Executive', years: '20+ yrs', substitutionMultiplier: 0.38, adjustmentSpeed: 0.20, reinstatementShare: 1.50, baselineHireRate: 0.07 },
];

/**
 * Jurisdictions.
 *
 * `capacity` - asymptotic share of automatable work actually deployed
 * against. Mapped from the IMF AIPI as `0.35 + 0.75 * AIPI`, so the US
 * (AIPI 0.77) reaches 0.93 and India (0.49) reaches 0.72. The floor reflects
 * that even low-preparedness economies eventually get cloud-delivered AI;
 * the mapping is ESTIMATE, the AIPI inputs are published.
 *
 * `adoptionMidpoint` - year deployment reaches half of capacity. Ordered by
 * AIPI, then adjusted for regulatory timing. EU midpoints sit earlier than a
 * pre-2026 version of this model would have put them because the AI Act's
 * Annex III obligations slipped to December 2027.
 *
 * `epl` - OECD EPRC rescaled from 0-6 to 0-1. OECD members use approximate
 * published EPRC values; non-OECD jurisdictions (SG, AE, IN, BR, NG) are
 * ESTIMATE from labour-law characteristics. India's statutory protection for
 * formal-sector workers is strict, but the score here is discounted for the
 * size of the informal sector, where it does not bind.
 *
 * `dynamism` - ability to redeploy displaced workers into newly created
 * work. ESTIMATE.
 *
 * `demographicPressure` - >1 where a large youth cohort intensifies the
 * entry-level squeeze, <1 where a shrinking workforce absorbs displacement
 * through attrition instead of dismissal. Japan is the clearest case of the
 * latter. ESTIMATE.
 */
export const JURISDICTIONS = [
  { name: 'United States', code: 'US', aipi: 0.77, eprc: 1.3, capacity: 0.93, adoptionMidpoint: 2026.8, adoptionSteepness: 0.85, epl: 0.22, dynamism: 1.15, demographicPressure: 1.00 },
  { name: 'Singapore', code: 'SG', aipi: 0.80, eprc: 0.7, capacity: 0.95, adoptionMidpoint: 2026.9, adoptionSteepness: 0.90, epl: 0.12, dynamism: 1.10, demographicPressure: 0.95 },
  { name: 'United Kingdom', code: 'UK', aipi: 0.74, eprc: 1.9, capacity: 0.91, adoptionMidpoint: 2027.4, adoptionSteepness: 0.80, epl: 0.32, dynamism: 1.00, demographicPressure: 1.00 },
  { name: 'Canada', code: 'CA', aipi: 0.73, eprc: 1.5, capacity: 0.90, adoptionMidpoint: 2027.6, adoptionSteepness: 0.78, epl: 0.25, dynamism: 0.98, demographicPressure: 1.00 },
  { name: 'United Arab Emirates', code: 'AE', aipi: 0.65, eprc: 1.8, capacity: 0.84, adoptionMidpoint: 2027.6, adoptionSteepness: 0.85, epl: 0.30, dynamism: 1.05, demographicPressure: 1.00 },
  { name: 'Australia', code: 'AU', aipi: 0.72, eprc: 1.9, capacity: 0.89, adoptionMidpoint: 2027.7, adoptionSteepness: 0.78, epl: 0.32, dynamism: 0.95, demographicPressure: 0.98 },
  { name: 'Germany', code: 'DE', aipi: 0.72, eprc: 2.6, capacity: 0.89, adoptionMidpoint: 2027.9, adoptionSteepness: 0.72, epl: 0.43, dynamism: 0.85, demographicPressure: 0.88 },
  { name: 'Japan', code: 'JP', aipi: 0.70, eprc: 2.1, capacity: 0.88, adoptionMidpoint: 2028.0, adoptionSteepness: 0.72, epl: 0.35, dynamism: 0.75, demographicPressure: 0.75 },
  { name: 'India', code: 'IN', aipi: 0.49, eprc: 2.9, capacity: 0.72, adoptionMidpoint: 2028.0, adoptionSteepness: 0.80, epl: 0.30, dynamism: 1.05, demographicPressure: 1.15 },
  { name: 'France', code: 'FR', aipi: 0.70, eprc: 2.8, capacity: 0.88, adoptionMidpoint: 2028.1, adoptionSteepness: 0.70, epl: 0.47, dynamism: 0.80, demographicPressure: 0.95 },
  { name: 'Brazil', code: 'BR', aipi: 0.52, eprc: 2.0, capacity: 0.74, adoptionMidpoint: 2028.8, adoptionSteepness: 0.70, epl: 0.33, dynamism: 0.85, demographicPressure: 1.05 },
  { name: 'Nigeria', code: 'NG', aipi: 0.35, eprc: 1.5, capacity: 0.61, adoptionMidpoint: 2029.6, adoptionSteepness: 0.65, epl: 0.25, dynamism: 0.80, demographicPressure: 1.20 },
];

/**
 * Employment protection slows adjustment but never blocks it: even the
 * strictest regime still adjusts at 25% of the speed of an at-will one,
 * because attrition, non-renewal and hiring freezes are available
 * everywhere.
 */
export const MAX_FRICTION = 0.75;

/** Years between labour being displaced and the offsetting work appearing. */
export const REINSTATEMENT_LAG_YEARS = 1.5;

/**
 * Global scale on job creation, relative to the labour freed by automation.
 *
 * The single most consequential assumption in the model, and the one with
 * the least empirical support: history says automation creates as much work
 * as it destroys eventually, but "eventually" has run to decades, and a
 * five-year window sits well inside the lag. 0.6 encodes a partial offset
 * within the horizon. Set it to 1.0 and most cells turn positive by 2030;
 * set it to 0.3 and almost nothing recovers. Treat conclusions that flip
 * between those two as unsupported by this model. ESTIMATE.
 */
export const REINSTATEMENT_STRENGTH = 0.6;

/**
 * Share of an occupation's demand elasticity that feeds back into headcount
 * rather than into margin, price cuts or capital. ESTIMATE.
 */
export const ELASTICITY_PASS_THROUGH = 0.6;

/** An occupation is never more than 95% substitutable at any level. */
export const MAX_AUTOMATABLE_SHARE = 0.95;

/** Baseline year: the counterfactual and the actual coincide here. */
export const BASE_YEAR = 2025;

export const PROJECTION_YEARS = [2026, 2027, 2028, 2029, 2030];

/**
 * Scenario multipliers. These shift the deployment curve earlier or later
 * rather than raising the ceiling, because the binding constraint on
 * deployment is organisational speed, not the eventual technical limit.
 */
export const SCENARIOS = {
  slow: 0.65,
  central: 1.0,
  fast: 1.45,
};

/**
 * Observed results the model is fitted to reproduce, from Brynjolfsson,
 * Chandar & Chen (2025). Asserted in test/calibration.test.js so that
 * parameter edits cannot silently break the fit.
 *
 * The paper's "most AI-exposed occupations" are represented here by the
 * occupations it studies directly - software development and customer
 * support - in the United States, at the entry level, by 2026.
 */
export const CALIBRATION_TARGETS = {
  jurisdiction: 'United States',
  year: 2026,
  occupations: ['Software engineering', 'Customer support & call centre'],
  /** ~16% relative employment decline for ages 22-25. Tolerance band. */
  entryHeadcountChange: { min: -0.19, max: -0.13 },
  /** Employment for experienced workers "remained stable". */
  midHeadcountChange: { min: -0.04, max: 0.02 },
};
