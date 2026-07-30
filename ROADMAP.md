# Roadmap

Where this project is, and what would make it better. Ordered by how much each
item changes whether the outputs can be trusted — not by how hard it is.

The organising principle: **this is a model whose credibility is its only
product.** Nobody needs another dashboard. What is scarce is a projection whose
every number can be traced to a source, whose uncertainty is stated rather than
hidden by a point estimate, and whose structure survives contact with the
mechanism it claims to describe. Everything below is ranked against that.

## Where it is today (v0.1.0)

Working:

- 6,300-cell grid — 21 job types × 5 experience levels × 12 jurisdictions × 5 years
- Pure model (`src/model.js`, `src/report.js`) with no Node built-ins, inlined
  into the browser build so the web app runs the same code as the CLI
- CLI with scenario / jurisdiction / occupation filters, hiring channel, CSV export
- Web app: trajectory, heatmap, ranking, headcount planner
- 23 tests including a calibration test that pins the fit to the Stanford/ADP result
- GitHub Pages deploy gated on a green test run

Known weak points, in the authors' own words in `README.md` and
`src/parameters.js`: country parameters are reconstructed rather than sourced,
aggregates are unweighted, job creation is the least-supported assumption in the
model, and anything past ~2028 is extrapolation.

---

## Phase 0 — Finish shipping (days)

Small, entirely mechanical, blocking everything downstream.

- [ ] **Turn on GitHub Pages.** Settings → Pages → Source: GitHub Actions, then
      re-run the deploy workflow. Until an admin does this the workflow fails at
      `configure-pages` and the site does not exist.
- [ ] **CI check for build drift.** `web/index.html` is generated output but is
      committed. Add a CI step that runs `node web/build.js` and fails if the
      working tree is dirty — otherwise a `src/model.js` edit silently ships a
      stale web app that disagrees with the CLI. The README's reproducibility
      claim ("any cell on the page is reproducible from the command line") is
      currently enforced by nothing.
- [ ] **`--json` output from the CLI.** The model is already exported as a
      library; the CLI only speaks fixed-width tables and CSV. JSON makes it
      scriptable without importing it.

## Phase 1 — Provenance (v0.2) — *highest value*

The model's honesty about its own sourcing is a real asset, and also the thing
most likely to end an argument with a skeptical reader. Close the gap.

- [ ] **Re-derive country parameters from raw datasets.** IMF AIPI (174
      economies) and OECD EPRC v4 are downloadable. Every value currently marked
      `ESTIMATE` that has a published source should stop being an estimate.
      This is the single largest credibility gain available for the effort.
- [ ] **Make provenance a data field, not a comment.** Each parameter carries
      `{ value, source, kind: 'published' | 'derived' | 'estimate' }`. Then:
  - a test asserts every parameter has a non-empty `source`
  - the CLI and web app can *show* which cells rest on estimates
  - "what happens if I only trust the published values" becomes a query
- [ ] **Surface estimate density in the UI.** A cell computed entirely from
      published inputs and one built on four interpolations should not look
      identical on screen. A provenance badge per view.
- [ ] **Non-OECD jurisdictions need a stated method.** SG, AE, IN, BR, NG have
      no EPRC score and are inferred from labour-law characteristics. Write down
      the rubric that produced each number so it can be argued with.

## Phase 2 — Uncertainty (v0.3)

Every output is currently a point estimate carried to one decimal place. The
README correctly warns that `REINSTATEMENT_STRENGTH` between 0.3 and 1.0 flips
most conclusions — but nothing in the tool tells you *which* conclusions flip.
Give it that ability, then let the confidence bands do the arguing.

- [ ] **Parameter ranges instead of scalars.** Each parameter gets a plausible
      interval. Existing point values become the central case, so nothing breaks.
- [ ] **Monte Carlo over the ranges.** Report p10 / p50 / p90 per cell. The
      headline table becomes "−21.4%" → "−21.4% (−31% to −12%)", which is both
      more honest and more useful.
- [ ] **Sensitivity / tornado analysis.** `--sensitivity` ranks parameters by
      how much they move a chosen output. This operationalises the README's own
      standard: a finding that survives the full parameter range is reportable,
      one that does not is not.
- [ ] **Bands in the web app.** Trajectory lines become shaded ranges. The
      heatmap gets a "robust to parameter uncertainty?" overlay — cells whose
      sign is stable across the range read differently from cells that flip.
- [ ] **A stated robustness claim in the README.** Which of the three headline
      findings survive the full range, and which do not. Say it plainly.

## Phase 3 — Structure (v0.4)

The current model computes each cell independently. That is defensible for a
five-year window and it is also the model's biggest structural blind spot.

- [ ] **Cohort progression between levels.** Entry, Junior, Mid, Senior and Lead
      are modelled as five unconnected populations, but they are one pipeline:
      five consecutive years of a collapsing entry tier is, mechanically, a
      mid-level shortage in the 2030s. The model cannot currently say this, and
      it is arguably the most consequential thing its own numbers imply. Add
      flows between levels, and the horizon extends past 2030 for a reason
      rather than by extrapolation.
- [ ] **Occupation-level demand coupling.** `demandElasticity` acts within an
      occupation only. Displaced clerical workers do not currently go anywhere.
      Even a crude reallocation matrix would be more truthful than zero.
- [ ] **A wage channel, or an explicit refusal to have one.** The Stanford
      finding is that adjustment ran through employment rather than
      compensation. That is a result the model should be able to *reproduce*,
      not merely assume by having no price mechanism at all.
- [ ] **Reinstatement lag by occupation.** `REINSTATEMENT_LAG_YEARS = 1.5`
      globally. New AI-adjacent software work appears faster than new clerical
      work does; one constant for both is a placeholder, and it is doing a lot
      of work in the results.

## Phase 4 — Coverage (v0.5)

Breadth, once the core is trustworthy. Deliberately after Phases 1–3: a wider
grid of weakly-sourced numbers is worse than a narrow grid of good ones.

- [ ] **Employment weights.** Aggregates are unweighted — every job type counts
      once — so today's headline means "the average job type", not "this
      country's labour force". ILO/ISCO employment-by-occupation data would let
      both readings coexist, with a toggle. This is the most frequently
      misread thing in the current output.
- [ ] **More jurisdictions.** China, South Korea, Netherlands, Mexico, Indonesia,
      Poland — meaningful AIPI and EPRC spread, and enough coverage to say
      something about the world rather than about twelve countries.
- [ ] **Occupation depth.** 21 job types is thin for workforce planning. ISCO-08
      sub-major groups would roughly triple it, and the ILO index is already at
      that granularity.
- [ ] **A robotics / physical-automation channel.** Skilled trades, warehouse and
      nursing look quiet here *only* because the model covers generative AI. That
      caveat is honest but it also means the model is silent on a large share of
      employment. A second channel — even a crude one — with its own deployment
      curve would remove the asterisk.
- [ ] **More calibration targets.** One paper, two occupations, one country, one
      year is a narrow anchor for a global model. Additional observed series
      (job-postings data, sectoral payroll) and a `fit.js` that re-derives the
      experience gradient rather than leaving it hand-tuned.

## Phase 5 — Product (v1.0)

Only worth doing once the numbers deserve the audience.

- [ ] **Shareable URLs.** Web app state lives in the DOM; a configured view
      cannot be linked. Encode filters in the query string. This is the single
      biggest usability gap — it is what people do with a tool like this.
- [ ] **CSV / PNG export from the browser.** Currently CSV requires the CLI.
- [ ] **Planner persistence.** An org shape entered into the planner is lost on
      reload. localStorage, plus import/export of the shape as JSON.
- [ ] **Scenario comparison.** Slow vs. central vs. fast side by side, rather
      than one at a time.
- [ ] **Accessibility and mobile pass.** Hand-rolled SVG charts with a tooltip
      div: audit keyboard navigation, contrast in both themes, and screen-reader
      output for the heatmap. The data tables behind each chart are already
      built, which is most of the work.
- [ ] **Publish to npm, add a CHANGELOG, document the library API.** `exports`
      is already configured; the package is a usable dependency today and is not
      described as one anywhere.

---

## Explicitly not planned

Stating these keeps scope honest.

- **A forecast.** This is a structured scenario and should keep saying so. No
  probability of a specific 2030 outcome.
- **Individual-level predictions.** "Will *my* job go" is not a question a
  cell-level model can answer, and answering it anyway would be the fastest way
  to make the project untrustworthy.
- **Live data ingestion.** Parameters change on the timescale of published
  research, not daily. A pipeline would add operational burden and no accuracy.
- **A backend.** Static site plus a pure model is the right architecture; every
  number stays reproducible from the command line. Keep it.

## Suggested order

If only three things get done: **Phase 1 provenance**, then **Phase 2
uncertainty bands**, then **Phase 3 cohort progression**. Those turn a
well-documented set of assumptions into something a workforce planner could
defend in a room — and the cohort work is what lets the model say the most
interesting thing its own numbers already imply.
