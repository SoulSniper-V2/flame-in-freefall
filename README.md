# Flame in Freefall

NASA Space Apps Challenge 2026 · [*Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data*](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/) · Team Tee to Three

The challenge asks teams to build an interactive, SI-powered dashboard that summarizes, ranks, and interprets microgravity combustion research to inform fire safety for human space exploration. This project turns NASA and partner investigation data into a traceable evidence explorer, habitat-specific rankings, and a model-informed next-experiment recommendation.

A dashboard that ranks NASA's microgravity combustion evidence for a given habitat atmosphere, shows how much fire-safety margin Earth tests lose in microgravity, and recommends the next experiment.

- **Dashboard:** https://soulsniper-v2.github.io/flame-in-freefall/
- **Demo video (30 s):** [`flame-in-freefall-demo.mp4`](submission/flame-in-freefall-demo.mp4)
- **Deck (7 slides):** [`flame-in-freefall-deck.pdf`](submission/flame-in-freefall-deck.pdf)
- **Technical report (7 pages):** [`flame-in-freefall-technical-report.pdf`](submission/flame-in-freefall-technical-report.pdf)
- **Executive brief (1 page):** [`flame-in-freefall-executive-brief.pdf`](submission/flame-in-freefall-executive-brief.pdf)

## Findings

- **Earth tests overstate the margin.** With NASA's oxygen margin of safety (NASA/TM-2008-215260, Eq. 1), Mylar burns in microgravity at 16.5% O₂ against 20.4% at 1 g (−3.9 points); Ultem −2.75, Nomex −1.2. The mean, −2.6, matches NASA's published value. A Moon base at 30% O₂ should re-test any thin material rated 30–33.9% on Earth.
- **No solid-material test reaches Moon-base air.** PSI's ISS solid-material tests stop at 22.2% O₂. Everything PSI holds at 26–40% O₂ is droplet or gas flames.
- **BASS-II outcomes restored.** PSI lists 129 BASS-II tests without outcomes. We recovered 124 from [NASA's BASS-II report (NASA/TM-20210011385)](https://ntrs.nasa.gov/citations/20210011385) and fit a burn model (held-out Brier 0.071 vs 0.108 base rate). Data: [`bass2_outcomes.csv`](web/public/data/bass2_outcomes.csv).
- **Next experiment.** A 3 mm heptane droplet at 36% O₂ and 7.7 psia, where the burning-rate model is 3.5× less certain than at ISS air.

## Data

- **PSI:** all 24 combustion investigations from PSI's public API; 2,009 table rows parsed into 1,186 O₂/pressure conditions, each traced to its NASA table cell.
- **NASA reports:** 84 open-access NTRS reports ([`catalog.json`](data/literature/catalog.json)). 708 measurements extracted, each kept only if its quote appears verbatim in the report ([`verify.py`](pipeline/lit/verify.py)).
- **BASS-II video:** flame areas measured from NASA's ISS footage (`pipeline/vision/`) are released in `data/vision/` but not used by the models.
- **Model training:** 794 measured ISS outcomes (FLEX burning rate and extinction, ACME CFI-G ignition).

## Models

Scikit-learn, cross-validated with whole test days held out ([`train_models.py`](ml/train_models.py), [`metrics.json`](web/public/models/metrics.json)).

| Model · target | n | Held-out | Baseline |
|---|---|---|---|
| Gaussian process · FLEX burning rate | 257 | R² 0.67, MAE 0.048 | MAE 0.107 (naive) |
| Deep ensemble · FLEX extinction | 206 | AUC 0.83 | AUC 0.77 (logistic) |
| Random forest · CFI-G ignition | 331 | Brier 0.120 | Brier 0.137 (logistic) |

Trained at ≤25% O₂ and tested above it, burning-rate error is 0.085 vs 0.203 naive. Helium mixtures show no gain over naive.

## Reproduce

```bash
pip install -r pipeline/requirements.txt && ./pipeline/run_all.sh   # rebuild data from the PSI API
python3 pipeline/lit/verify.py                                      # re-verify literature quotes
python3 ml/train_models.py                                          # retrain models
cd web && npm ci && npm test && npm run dev                         # dashboard on localhost:5173
```

The report source is [`submission/report/report.tex`](submission/report/report.tex) (`latexmk -pdf`); its figures come from [`submission/methods/figs.py`](submission/methods/figs.py).

| Folder | Contents |
|---|---|
| `pipeline/` | PSI fetch and parsing, literature verification, BASS-II restoration |
| `ml/` | model training |
| `si/` | SI interpretation facts and verifier |
| `web/` | React dashboard |
| `data/` | PSI tables, literature records, rejected records |
| `submission/` | deck, report (with LaTeX source), brief, video |

## Limits

- PSI holds no partial-gravity combustion data.
- The models describe droplet and gas flames, not fabrics or plastics.
- The thin-material margin rests on three materials from one report.
- Scores rank evidence; they do not certify materials.

## Use of SI

SI extracted literature measurements and PSI record summaries, scored relevance, labelled BASS-II outcomes, wrote interpretation sentences, voiced the video and assisted with code. Each output is checked by a script or reviewed by the team: literature values must quote their report verbatim, interpretation sentences may only use numbers from their cited facts, and BASS-II labels were checked against NASA's text. The video narration is a synthetic voice because the team members are minors. Not affiliated with or endorsed by NASA. Code and text are the team's own; NASA PSI data is CC0-1.0.

## NASA data citations

PSI dataset DOIs (CC0): PSI-10 doi:10.60555/w4zy-bt45 · PSI-20 doi:10.60555/vb93-3y72 · PSI-21 doi:10.60555/23e1-9950 · PSI-22 doi:10.60555/se5a-8c73 · PSI-23 doi:10.60555/k57n-p030 · PSI-25 doi:10.60555/4qc4-de67 · PSI-26 doi:10.60555/58h4-dy80 · PSI-39 doi:10.60555/m6pj-a914 · PSI-47 doi:10.60555/ztgj-d202 · PSI-60 doi:10.60555/mzjm-yv57 · PSI-62 doi:10.60555/e9xp-ex83 · PSI-68 doi:10.60555/byp8-h018 · PSI-69 doi:10.60555/mbq8-0451 · PSI-98 doi:10.60555/0t15-1z43 · PSI-99 doi:10.60555/2chp-m469 · PSI-100 doi:10.60555/040q-4h36 · PSI-101 doi:10.60555/2np7-jv14 · PSI-102 doi:10.60555/gd4k-8h62 · PSI-106 doi:10.60555/pm12-rg61 · PSI-107 doi:10.60555/9kbh-e962 · PSI-115 doi:10.60555/q0v5-1v28 · PSI-117 doi:10.60555/gz0q-b577 · PSI-142 doi:10.60555/80qf-vj95 · PSI-159 doi:10.60555/cyt1-kh64

## License
Code is licensed under the Apache License 2.0 (see LICENSE). NASA data are public domain (PSI datasets are CC0); fonts and libraries keep their own licenses.
