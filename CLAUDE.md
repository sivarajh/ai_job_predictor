# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A scenario model of AI's effect on employment across job type × experience level ×
jurisdiction × year (2026–2036), with industry and age band as lenses over the
result. It ships as a zero-dependency Node CLI plus a self-contained web app.

**It is a scenario, not a forecast.** That framing is load-bearing: it decides how
parameters are documented, how results are worded, and what the caveats say. Do not
let output drift toward sounding like prediction.

## Commands

```bash
npm test                                        # node:test, no install needed
node src/cli.js                                 # headline tables
node src/cli.js --list                          # valid industries and age bands
node src/cli.js --industry Technology --detail  # sector lens, by job type
node src/cli.js --age 55+ --hiring              # age lens, openings channel
node src/cli.js --csv outputs/projections.csv   # full grid (13,860 rows)
node web/build.js                               # rebuild web/index.html + site/
```

There are no dependencies and no lockfile. Keep it that way — `node --test` and
plain ES modules cover everything, and the artifact build depends on it.

## Architecture

```
src/parameters.js   all tunable values, each with a source citation or ESTIMATE marker
src/model.js        the projection engine — pure functions, no I/O
src/report.js       aggregation, tables, CSV, org rollups — also pure
src/cli.js          arg parsing and printing; the ONLY module that touches fs
web/template.html   the web app, with a /* __MODEL_SOURCE__ */ placeholder
web/build.js        inlines the model into two outputs (see below)
test/fixtures/      the pre-modifier baseline snapshot
```

### The constraint that matters most

**`src/model.js` and `src/report.js` must never import Node built-ins.** `web/build.js`
inlines them verbatim into the browser page, so the web app runs the *same* model as
the CLI rather than replaying a precomputed table. Any cell on the page must be
reproducible with `node src/cli.js`. Adding `node:fs` to either file silently breaks
the web build.

### Two build outputs, deliberately different

- `web/index.html` — a document **fragment**: no doctype, no `<head>`. The Claude
  artifact host supplies that skeleton and a CSS reset at publish time and rejects
  pages that bring their own.
- `site/index.html` — a **complete document** for GitHub Pages, which serves files
  raw. `<title>` and `<style>` are lifted into `<head>`, since a `<title>` in `<body>`
  does not reliably set the document title.

`site/` is gitignored; `web/index.html` is committed.

## Model design rules

Read `src/model.js`'s header comment before changing the engine. Several choices look
arbitrary and are not:

1. **Reinstatement is never gated by employment protection.** The productivity gain
   exists once the automation runs, whether or not the employer could legally act on
   it. Gating job creation on dismissal law wrongly makes strict-protection markets
   look like they generate less new work. An earlier version had this bug.
2. **`adjustmentSpeed` falls steeply with seniority, and that is the point.** Junior
   headcount adjusts through *not hiring* — no notice period, no severance, no works
   council. Senior headcount only adjusts through dismissal. This mechanism, not task
   substitutability, is what reproduces the observed collapsing-junior-tier pattern.
3. **Age never touches displacement**, only reinstatement and hiring. How automatable
   a role is does not depend on who holds it.
4. **Age acts as an amplifier, not a level shift.** Age bias in hiring exists in the
   no-AI counterfactual too, and this model reports only the difference from it — so
   a cell with no AI effect must show no age effect.
5. **Industry's speed and ceiling are separate levers.** A hospital can be an eager
   adopter and still be barred from automating a sign-off.

### Industry and age are modifiers, not grid dimensions

As stored dimensions they would take the grid from 6,300 to 831,600 rows. They are
modifier layers over a neutral baseline instead. **`test/baseline.test.js` asserts
that baseline industry + baseline age reproduce the pre-modifier numbers exactly**,
against a fixture captured before either existed. If that test fails, the change
altered the cross-sector all-ages result rather than sitting on top of it — which
also invalidates the calibration, since that is fitted at baseline. Do not
regenerate the fixture to make it pass.

## Parameters

Every value in `src/parameters.js` carries either a source citation or an explicit
`ESTIMATE` marker. Preserve that convention — the file's credibility rests on a
reader being able to tell measured values from judgement calls.

Anchored on: ILO Working Paper 140 (2025) for task exposure and the
automation/augmentation split; Brynjolfsson, Chandar & Chen, "Canaries in the Coal
Mine?" (Stanford, ADP microdata) for the experience gradient; the IMF AI Preparedness
Index for deployment capacity; OECD EPRC for adjustment friction.

Per-country index values were reconstructed from published summary figures rather
than downloaded from the source datasets, because the environment this was built in
allowed search but not document retrieval. Anchor points are exact; the rest are
interpolations marked `ESTIMATE`.

`REINSTATEMENT_STRENGTH` is the most consequential single assumption. At 1.0 most
cells turn positive by 2030; at 0.3 nothing recovers. Any conclusion that flips
between those is not supported by this model, and should not be stated.

## Calibration is fitted, not assumed

The experience gradient reproduces the Stanford/ADP result (~16% relative decline for
ages 22–25 in the most exposed occupations, experienced workers stable).
`test/calibration.test.js` asserts the fit both through the Entry experience proxy and
against the 22–25 age band directly. If a parameter change breaks it, re-fit the
parameters — do not widen the tolerance band.

## Honesty requirements

These are product requirements, not style preferences:

- Everything from `EXTRAPOLATION_FROM` (2029) on is marked — `†` in CLI tables, a
  shaded region in the charts. Do not remove the marking to tidy up output.
- The age lens carries weaker evidence than the experience lens. The README and the
  web app both say so explicitly. Keep it that way; do not present them as equally
  grounded.
- Aggregates are unweighted, so they mean "the average job type", not "this country's
  labour force". Say so wherever they are reported.
- Only the generative-AI channel is modelled. Robotics is out of scope, which is the
  only reason trades and warehouse work look quiet.

## Charts

The web app follows the `dataviz` skill. Two specifics worth knowing before editing:

- Experience levels are an **ordered** scale, so they take an ordinal single-hue blue
  ramp, not eight categorical hues. Signed values use a diverging red↔blue pair with a
  neutral gray midpoint.
- Every chart has a table-view twin, and identity never rests on colour alone
  (legend plus selective direct labels).

Run the palette validator before shipping any new colour, and render the page in
Chromium at desktop and mobile widths afterwards — the validator checks colour, not
layout, and label collisions have shipped twice.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on pushes to the
default branch, gated on `npm test`.

Pages must be enabled once by a repo admin (**Settings → Pages → Source: GitHub
Actions**). A workflow cannot do it — the API returns `Resource not accessible by
integration`. Until then the run fails at `configure-pages` with
`Get Pages site failed … Not Found`, which is what that error means.
