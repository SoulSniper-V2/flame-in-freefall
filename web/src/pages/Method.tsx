import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { type DB } from '@/data'
import { PageHead } from '@/components/Shell'
import { useModels } from '@/ml'

const GH = 'https://github.com/SoulSniper-V2/flame-in-freefall/blob/main/'

function Block({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return <section className="grid gap-6 border-t py-12 md:grid-cols-[220px_1fr]">
    <h2 className="display text-[22px]" data-n={n}>{title}</h2>
    <div className="max-w-3xl space-y-4 text-[15px] leading-relaxed text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">{children}</div>
  </section>
}

export default function Method({ db }: { db: DB }) {
  const m = useModels()?.metrics
  return <>
    <PageHead eyebrow="Method" title="Method">
      How every number was made. <a className="link" href={`${import.meta.env.BASE_URL}technical-report.pdf`} target="_blank" rel="noreferrer">Technical report (PDF)</a> · <a className="link" href={`${import.meta.env.BASE_URL}executive-brief.pdf`} target="_blank" rel="noreferrer">One-page brief</a>
    </PageHead>
    <div className="wrap">
      <Block n="01" title="Data">
        <p>The PSI website is an Angular app backed by a public JSON API. We read the API directly instead of scraping pages:</p>
        <div className="overflow-x-auto rounded-md border bg-surface"><table className="tbl num text-[12.5px]"><tbody>
          <tr><td className="text-foreground">GET /geode-py/ws/repo/search?type=investigation&amp;ffield=Research Area&amp;fvalue=Combustion Science</td><td className="font-sans">all combustion investigations</td></tr>
          <tr><td className="text-foreground">GET /geode-py/ws/repo/investigations/&#123;PSI-ID&#125;</td><td className="font-sans">objective, approach, hypothesis, impacts, hardware, PIs, publications, DOI, file list</td></tr>
          <tr><td className="text-foreground">GET /geode-py/ws/studies/&#123;PSI-ID&#125;/download?file=…</td><td className="font-sans">each Experimental table CSV</td></tr>
        </tbody></table></div>
        <p><b>{db.meta.count} investigations</b> (ACME BRE, CLD Flame, E-FIELD Flames, s-Flame, Flame Design, CFI-G; BASS, BASS-II; Saffire-I, II, III; SAME, SAME-R; DAFT, DAFT-2; FLEX, FLEX-2; CFI; SPICE; SLICE; and ground studies PSI-60, 62, 115, 117, 142). <b>{db.meta.tableRows.toLocaleString()} table rows</b> were parsed into <b>{db.meta.testPoints.toLocaleString()} unit-normalised conditions</b> (mmHg, kPa, bar, psia and atm to atm; percent and mole fraction to fraction). Snapshot: {new Date(db.meta.generated).toUTCString()}.</p>
        <p>Code: <a className="link" href={`${GH}pipeline/fetch_psi.py`}>fetch_psi.py</a>, <a className="link" href={`${GH}pipeline/parse_tables.py`}>parse_tables.py</a>, <a className="link" href={`${GH}pipeline/build_dataset.py`}>build_dataset.py</a>.</p>
      </Block>
      <Block n="02" title="Extraction and ranking">
        <p>An SI (AI) assistant read each PSI record and its tables and wrote a structured extraction: fuels, geometry, oxygen, pressure, airflow, gravity, hardware, sensors, key findings and Earth applications, plus a 0–10 relevance score for <b>prevention, detection, suppression and modeling</b>, each with a one-line rationale tied to a PSI field. Anything PSI does not state is marked unknown. The team reviewed every extraction against its record (<a className="link" href={`${GH}si/extractions.py`}>extractions.py</a>).</p>
        <p><b>Fire-safety index</b> = 0.6 × weighted category mean (prevention 35%, suppression 25%, detection 20%, modeling 20%) + 0.4 × best single category.</p>
        <p><b>Habitat score</b> = 50% fire-safety index + 25% atmosphere match + 10% gravity coverage + 15% material realism. Atmosphere match is exp(−d) to the nearest tabulated test point, with d measured in units of 10 O₂ points and 0.3 atm; points that tabulate only O₂ count at 60%. Gravity coverage is 1.0 for microgravity data in a microgravity habitat and 0.65 otherwise (0.8 for E-FIELD, which mimicked buoyancy). The brief recomputes all of this live when you change the atmosphere or the weights, and reports how stable the top five are.</p>
      </Block>
      <Block n="03" title="Models">
        <p>Three surrogates, trained in <a className="link" href={`${GH}ml/train_models.py`}>train_models.py</a> with scikit-learn and exported as plain JSON weights that run in the browser:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Droplet burning rate</b>: Gaussian-process regression (RBF with learned per-feature length scales plus white noise) on {m?.flex_k.n ?? 257} FLEX measurements, from O₂, pressure, CO₂ and helium fractions, fuel and initial diameter. Held-out R² {m?.flex_k.r2.toFixed(2)}, MAE {m?.flex_k.mae.toFixed(3)} mm²/s against {m?.flex_k.baseline_mae.toFixed(3)} for the mean, and {m ? (m.flex_k.coverage95 * 100).toFixed(0) : 92}% of 95% intervals contain the measurement.</li>
          <li><b>Droplet extinction</b>: an 8-member bootstrap ensemble of small neural networks on {m?.flex_ext.n ?? 206} FLEX tests that ended in extinction or burnout. AUC {m?.flex_ext.auc.toFixed(2)} against {m?.flex_ext.logreg_auc.toFixed(2)} for logistic regression; its calibration (Brier {m?.flex_ext.brier.toFixed(3)}) only ties logistic regression ({m?.flex_ext.logreg_brier.toFixed(3)}), so its advantage is in ranking risk, not in absolute probabilities.</li>
          <li><b>Gas-flame hot ignition</b>: a 150-tree random forest on {m?.cfig_ign.n ?? 331} ACME CFI-G attempts from 12% to 85% O₂, chosen over logistic, polynomial-logistic, neural-network and gradient-boosting candidates by grouped-CV Brier score. Brier {m?.cfig_ign.brier.toFixed(3)} against {m?.cfig_ign.logreg_brier.toFixed(3)} for logistic regression and {m?.cfig_ign.baseline_brier.toFixed(3)} for the base rate; AUC {m?.cfig_ign.auc.toFixed(2)}.</li>
        </ul>
        <p>Validation is 5-fold grouped cross-validation with <b>whole test days held out</b>, because tests on the same day share hardware state and would leak. Every prediction is labelled as inside or outside the tested range.</p>
        <p><b>Next-experiment recommender</b>: for candidate conditions from 15% to 40% O₂ and 6.6 to 17.6 psia, value = GP epistemic standard deviation × (0.15 + closeness to the lunar-base and rover atmospheres). That is a standard active-learning acquisition rule: it points to where one more test would shrink the model’s ignorance about habitat air fastest.</p>
      </Block>
      <Block n="04" title="Literature and the oxygen margin">
        <p>AI agents read 84 open NASA reports (NTRS and PSI attachments) and extracted flame-spread rates, flammability and extinction limits, ignition times and flame sizes with their conditions. A script keeps a record only if its quote occurs verbatim in the report text and contains the number; rejected records are published. Each record is labelled measured, estimate, model or cited. The result is 708 unique records (<a className="link" href={`${GH}pipeline/lit/verify.py`}>verify.py</a>).</p>
        <p>The <Link className="link" to="/margin">oxygen margin of safety</Link> follows NASA/TM-2008-215260, Eq. 1: the mean of the microgravity limits minus the mean of the 1-g limits, computed within each report that measured both. Our thin-material mean (−2.6) matches the value NASA published in 2012; unit tests fail if it drifts. All three thin materials come from one report, so this checks our pipeline rather than replicating NASA.</p>
        <p><b>BASS-II outcomes.</b> PSI’s BASS-II table gives each test’s conditions but not its outcome. We parsed Appendix A of the BASS-II summary report (NASA/TM-20210011385), joined each test’s written observation to its PSI row, and SI labelled whether a flame was sustained (<a className="link" href={`${GH}pipeline/bass2/labels.py`}>labels.py</a>, every label shown next to its quote on the Margin page). A logistic model with one oxygen slope and a per-material offset is scored by leaving one test out at a time, with 1,000 bootstrap resamples for intervals. Five calibrated final-O₂ values that cannot be readings (raw reading missing in the report) are flagged, not used.</p>
      </Block>
      <Block n="05" title="Ask">
        <p>Questions are answered by retrieval and computation, never by generation. One question runs four steps: BM25 (and optional in-browser MiniLM) retrieval over 400 PSI passages, a query over the 708 verified measurements, the three models at the named habitat or atmosphere, and a chart of that atmosphere against every tested condition. Every sentence shown is a quote with its source. No question leaves your machine.</p>
      </Block>
      <Block n="06" title="Limits">
        <ul className="list-disc space-y-2 pl-5">
          <li>Only values published in PSI records and tables are used. Many investigations do not tabulate O₂ or pressure; BASS-II and Saffire tabulate O₂ but not pressure.</li>
          <li>ACME BRE pressures are the target atmospheres named in its objectives, shown as open circles. FLEX-2 points are its tabulated test matrix.</li>
          <li>PSI has no partial-gravity combustion data. The Mars base is assumed to share the lunar-base atmosphere.</li>
          <li>Models cover droplet and gaseous flames in microgravity, not fabrics or plastics. The image and video archives were not processed.</li>
          <li>The oxygen margin rests on three thin materials and one thick one; held out one at a time, the worst-case de-rating missed Mylar by 1.1 points. It flags materials for testing; it does not rate them.</li>
          <li>Scores and predictions are for research triage and education. They are not flammability certification.</li>
        </ul>
      </Block>
      <Block n="07" title="Use of SI">
        <p>SI was used in eight places, each checked by a method that does not depend on the SI: literature mining (verbatim-quote firewall), PSI record extraction (team review against each record), BASS-II outcome labels (each shown beside NASA’s note, cross-checked against an independent NASA paper), interpretation (short briefs written from numbered facts; <a className="link" href={`${GH}si/verify_interp.py`}>verify_interp.py</a> rejects any sentence with an uncited fact, a number not in its cited facts, or an overclaiming word), model training (scikit-learn, grouped and out-of-distribution validation; unit tests prove the browser copies match), retrieval (quotes only, nothing generated), the demo video’s narration (a synthetic voice, used because the team members are minors and may not appear in the video; disclosed on screen and in the file), and engineering: SI coding assistants wrote most of the pipeline and this site, directed and reviewed by the team. The question and the method came from the challenge text and the PSI data. The models are ordinary scikit-learn models trained on NASA measurements, and the site runs only open-source code in your browser. No user data is sent to any AI service.</p>
      </Block>
      <Block n="08" title="References">
        <ul className="space-y-1.5">
          {[['NASA Physical Sciences Informatics, combustion', 'https://psi.nasa.gov/physci/repo/search?q=combustion'], ['NASA Glenn Combustion Science', 'https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/'], ['A Researcher’s Guide to Combustion Science', 'https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/'], ['Apollo 1 lessons learned (NASA SMA)', 'https://sma.nasa.gov/sma-disciplines/accllp/apollo-1'], ['Fire aboard Mir, 25 years on', 'https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/'], ['asciicn ASCII engine', 'https://asciicn.dev'], ['dithercn dither engine', 'https://dithercn.dev'], ['scikit-learn', 'https://scikit-learn.org'], ['transformers.js and all-MiniLM-L6-v2', 'https://huggingface.co/Xenova/all-MiniLM-L6-v2'], ['React, Vite, Tailwind CSS, lucide icons; Inter and IBM Plex Mono fonts (OFL)', 'https://github.com/SoulSniper-V2/flame-in-freefall/blob/main/web/package.json']].map(([t, u]) =>
            <li key={u}><a className="link" href={u} target="_blank" rel="noreferrer">{t}</a></li>)}
        </ul>
        <p className="pt-2">Team Tee to Three, NASA Space Apps 2026, Raleigh. <Link className="link" to="/">Back to the overview</Link>.</p>
      </Block>
    </div>
  </>
}
