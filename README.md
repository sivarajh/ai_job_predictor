# ai_job_predictor

A scenario model of how AI changes employment, resolved across **job type ×
experience level × jurisdiction × year**, from 2026 to 2036, with **industry** and
**age band** available as lenses over the result.

Every number is employment measured against a **no-AI counterfactual** — how many
more or fewer people are doing a job than would have been, absent AI. It is not a
forecast of unemployment, and it does not net out the business cycle, immigration,
or anything else happening to labour markets at the same time.

Built for workforce planning: the outputs roll up to function-and-level views and a
headcount planner, because the question it is meant to answer is "how does my org
need to change, by function, level and location, over five years".

## Quick start

No dependencies, no install. Node 20+.

```bash
node src/cli.js                                     # headline tables
node src/cli.js --scenario fast                     # faster deployment
node src/cli.js --industry "Public sector"          # one sector's timing
node src/cli.js --age 55+                           # one age band's recovery
node src/cli.js --jurisdiction Germany --detail     # one market, by job type
node src/cli.js --occupation "Software engineering" # one job type, all markets
node src/cli.js --hiring                            # openings instead of headcount
node src/cli.js --list                              # valid industries and age bands
node src/cli.js --csv outputs/projections.csv       # full 13,860-row grid
npm test                                            # 41 tests, node:test
node web/build.js                                   # rebuild the web app
```

## What it says

At the central deployment speed, averaged over all job types and markets:

| Experience | 2026 | 2028 | 2030† | 2033† | 2036† |
|---|---|---|---|---|---|
| Entry (0–2 yrs) | −5.7% | −14.5% | −21.4% | −24.6% | −25.1% |
| Junior (2–5 yrs) | −2.8% | −6.9% | −9.8% | −10.7% | −10.9% |
| Mid (5–10 yrs) | −0.9% | −1.8% | −1.9% | −1.4% | −1.3% |
| Senior (10–20 yrs) | −0.3% | −0.3% | +0.2% | +0.9% | +1.0% |
| Lead / Executive (20+) | −0.0% | +0.1% | +0.7% | +1.4% | +1.5% |

† extrapolated — see the horizon caveat below.

The spread between the top and bottom rows is the finding. It is the same
technology in the same markets; what differs is career stage.

Note where the curves flatten. Most of the damage is done by 2030; the following
six years mostly re-run the same logic against a saturating deployment curve. A
model like this has more to say about **when** and **who** than about 2036.

Industry changes the timing far more than the destination. Entry-level clerical
work in the US:

| Sector | 2027 | 2030† | 2036† |
|---|---|---|---|
| Technology | −52.3% | −65.4% | −66.7% |
| Financial services | −25.4% | −54.0% | −59.4% |
| Healthcare | −14.1% | −45.2% | −54.8% |
| Public sector | −10.5% | −43.1% | −57.5% |

A five-fold gap in 2027 closes to well under two-fold by 2036. Slow institutions
buy years, not immunity — which is the single most useful thing here for anyone
planning a workforce.

Three things drive it:

1. **Automation, not exposure, predicts job loss.** Occupations where AI does the
   task outright (clerical, translation, call centres) lose headcount; occupations
   where it assists (consulting, law, nursing) barely move even at similar
   exposure.
2. **Junior headcount adjusts through hiring; senior headcount adjusts through
   dismissal.** Not hiring has no notice period, no severance and no works council.
   This mechanism, more than task substitutability, is what produces a collapsing
   junior tier beside a stable experienced one.
3. **Institutions change timing and depth, not direction.** At-will markets move
   first and hardest; strict-protection markets arrive later and shallower. No
   jurisdiction in the model escapes it, and none spares its entry level.

## Layout

```
src/parameters.js   parameter tables, each block citing its source
src/model.js        the projection engine — pure, no Node built-ins
src/report.js       aggregation, tables, CSV, org rollups — also pure
src/cli.js          argument parsing and printing (the only file touching fs)
web/template.html   the web app
web/build.js        inlines the model into web/index.html
test/               node:test — model, report, and the calibration fit
```

`model.js` and `report.js` avoid Node built-ins so `web/build.js` can inline them
unchanged. The web app therefore runs **the same model as the CLI**, live in the
browser, rather than replaying a precomputed table — so any cell on the page is
reproducible from the command line. (Spot check: Germany / Administrative &
clerical / Entry / 2030 reads −38.2% in both.)

## Deployment

The web app deploys to GitHub Pages from `.github/workflows/deploy.yml` on every
push to the default branch. The job runs the test suite first and only deploys if
it is green, so a parameter change that breaks the calibration fit to observed
payroll data cannot reach the published site.

**One manual step is required before the first deploy succeeds.** GitHub will not
let a workflow create the Pages site for a repository — the API answers `Resource
not accessible by integration` — so Pages has to be switched on by a repo admin:

> **Settings → Pages → Build and deployment → Source: _GitHub Actions_**

Then re-run the workflow (Actions → Deploy web app → Re-run jobs), or push
anything. Until that is done the run fails at `configure-pages` with
`Get Pages site failed … Not Found`, which is what that error means.

The site publishes at `https://sivarajh.github.io/ai_job_predictor/`.

## How the model works

For each cell and year:

1. **Automatable share** — `exposure × automationShare × experienceMultiplier`.
   The share of the cell's work AI does outright rather than assists with.
2. **Deployment** — a logistic curve per jurisdiction, capped by that market's
   capacity to deploy. Exposure is potential; deployment is what happens.
3. **Displacement** — deployed automation becomes a headcount change only at the
   speed institutions allow: `friction = f(employment protection)`, scaled by an
   adjustment speed that falls steeply with seniority.
4. **Reinstatement** — a lagged offset as cheaper output raises demand and new
   AI-adjacent roles appear, accruing to senior staff and dynamic labour markets.

`net = reinstatement − displacement`.

### Industry and age are lenses, not extra grid dimensions

Both were deliberately built as **modifier layers over a neutral baseline** rather
than stored dimensions. As dimensions they would take the grid from 6,300 rows to
831,600, put a ~15MB CSV in the repo, and fill it with combinations nobody asked
for (nursing in construction, 22-25 Lead/Executive). As modifiers, every
combination stays reachable from the CLI and the web app while the exported grid
stays small.

The guarantee that makes this legitimate is tested: with the baseline industry and
baseline age selected, the model reproduces the pre-existing numbers **exactly**
(`test/baseline.test.js`, against a fixture captured before either existed).

**Industry** moves two things independently — how fast a sector gets there
(`adoptionShift`) and how far it is ever allowed to go (`regulatoryCeiling`).
Keeping them separate matters: a hospital can be an eager adopter and still be
barred from automating a sign-off. Sector demand growth is a third, separate lever
on job creation.

**Age** acts only on what happens *after* displacement. How much of a role AI takes,
and how fast an employer can act on it, depend on the job and the jurisdiction, not
on the birthday of whoever holds it — so age moves recovery and hiring, never
displacement. It is an amplifier rather than a level shift, because age bias in
hiring exists in the no-AI counterfactual too and this model reports only the
difference from it.

Reinstatement is deliberately **not** a function of employment protection. The
productivity gain exists once the automation runs, whether or not the employer was
legally able to act on it — gating job creation on dismissal law would wrongly make
strict-protection markets look like they generate less new work.

The model also reports a separate **hiring channel**. A level that must shrink does
so by not replacing leavers, so the whole headcount change lands on the hiring plan;
dividing by the baseline hire rate is why a modest headcount effect shows up as a
severe collapse in openings. It also means openings *recover* once a level finishes
shrinking, while headcount stays permanently lower — a distinction that matters if
you are reading job-postings data as a leading indicator.

## Calibration

The experience gradient is **fitted to observed data, not assumed**.

Brynjolfsson, Chandar & Chen measured a ~16% relative employment decline for workers
aged 22–25 in the most AI-exposed occupations using ADP payroll microdata, with
experienced workers in the same occupations holding steady, adjustment running
through employment rather than pay, and declines concentrated where AI automates
rather than augments.

The parameters are set so the model reproduces that result — it returns −16.8% for
entry-level staff and −2.3% for mid-career staff in US software engineering and
customer support in 2026. `test/calibration.test.js` asserts the fit still holds, so
a parameter edit cannot silently break it.

The published finding is stated in *age* terms (22–25). Before age bands existed
the model could only proxy that through the Entry experience level; it is now
checked both ways — through the experience proxy at baseline age, and against the
22–25 band directly.

## Sources

| Parameter | Source |
|---|---|
| Task exposure, automation/augmentation split | [ILO Working Paper 140 (2025)](https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure) — refined global index, ~30k tasks, ~50k human assessments, ISCO-08 |
| Experience gradient (calibration target) | [Brynjolfsson, Chandar & Chen, "Canaries in the Coal Mine?"](https://digitaleconomy.stanford.edu/publication/canaries-in-the-coal-mine-six-facts-about-the-recent-employment-effects-of-artificial-intelligence/) — Stanford Digital Economy Lab, ADP microdata through April 2026 |
| Deployment capacity | [IMF AI Preparedness Index](https://www.imf.org/external/datamapper/datasets/AIPI) — 174 economies |
| Adjustment friction | [OECD Indicators of Employment Protection](https://www.oecd.org/en/data/datasets/oecd-indicators-of-employment-protection.html) — EPRC v4, regular contracts, 0–6 |
| EU deployment timing | AI Act Annex III high-risk obligations deferred from August 2026 to December 2027 |

**On provenance, honestly:** the environment this was built in permitted search but
not direct document retrieval, so per-country index values were reconstructed from
published summary figures rather than downloaded from the source datasets. Anchor
points quoted in the sources (Singapore 0.80 / US 0.77 / India 0.49 on the AIPI;
France ~2.8 on the EPRC) are exact; the remaining country values are interpolations
and are marked `ESTIMATE` in `src/parameters.js`. Re-derive them from the raw
datasets before using this for anything consequential. Non-OECD jurisdictions have no
EPRC score at all and are estimated from labour-law characteristics.

## What this is not

- **A forecast.** It is a structured scenario. The parameters are anchored on
  published research; the combination of them is a modelling judgement.
- **Complete.** Only the generative-AI channel is modelled. Robotics and physical
  automation are out of scope, which is the only reason skilled trades and warehouse
  work look quiet here.
- **Confident about job creation.** This is the weakest assumption in the model, and
  the one that most changes the answer. History says automation eventually creates as
  much work as it destroys, but "eventually" has run to decades and a five-year window
  sits well inside that lag. `REINSTATEMENT_STRENGTH = 0.6` encodes a partial offset.
  Set it to 1.0 and most cells turn positive by 2030; set it to 0.3 and almost nothing
  recovers. Treat any conclusion that flips between those two as unsupported.
- **Weighted.** Aggregates are unweighted — every job type counts once — so they mean
  "the average job type", not "this country's labour force".
- **Equally confident across its two lenses.** The experience gradient is *fitted* to
  payroll microdata. The age multipliers are estimates: that re-employment after
  displacement falls with age is a robust, long-standing finding, but the specific
  numbers here are not calibrated against any AI-era dataset. Trust the shape of the
  age result well before its size. The industry parameters are estimates too —
  directionally well supported, but no published index gives sector-level AI
  deployment rates.
- **Grounded past 2028.** Everything from 2029 on is extrapolation, marked `†` in the
  CLI and shaded in the web app. The payroll data the model is fitted to runs to
  April 2026; a diffusion curve can be defended a couple of years past its last
  observation, not a decade. The later years are the model's internal logic running
  forward with nothing to check it against. The ordering of cells is more trustworthy
  than the magnitudes, and the magnitudes more trustworthy than any single number —
  and that applies far more harshly after 2030 than before it.
