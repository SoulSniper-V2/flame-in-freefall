import type { Cat } from "@/data"
// Curated, cited takeaways per defense layer (each sentence paraphrases the linked PSI record).
export const TAKE: Record<Cat, { h: string; pts: [string, string][] }> = {
  prevention: { h: 'Choose materials and atmospheres that cannot sustain a fire', pts: [
    ['PSI-25', 'Materials can burn in microgravity under low ventilation where 1-g screening says otherwise — BASS-II questions whether upward 1-g burning (NASA-STD-6001 Test 1) is conservative for space.'],
    ['PSI-20', 'At the 10.2 psia / 26.5% and 8.2 psia / 34% exploration atmospheres, BRE saw quasi-steady burning of PMMA- and nylon-like flames with no airflow; at 21% O₂ they self-extinguished.'],
    ['PSI-99', 'Saffire-II compared nine materials directly: silicone barely burned in microgravity, PMMA flames anchored at the sample base.'],
    ['PSI-62', 'PSI data now feed predictive flame-spread models (the BASS “Goldilocks” flammability zone) for screening new materials.']] },
  detection: { h: 'Detect smoke that behaves differently without buoyancy', pts: [
    ['PSI-102', 'SAME hypothesized microgravity smoke particles grow larger with lower number density, which can change how detectors respond or stop them alarming.'],
    ['PSI-101', 'SAME-R ran 66 test points across Kapton, Teflon, silicone, Pyrell and lampwick and validated the lognormal size-distribution assumption.'],
    ['PSI-47', 'DAFT showed commercial particle counters can be modified to work in microgravity — the instrument basis for SAME.'],
    ['PSI-107', 'SPICE measured smoke points of 526 flames, linking flame size to soot release for detector sensitivity.']] },
  suppression: { h: 'Put fires out when ventilation shutdown is not enough', pts: [
    ['PSI-26', 'BASS assessed nitrogen, an inert gaseous agent similar to that used on ISS, against flames over different materials, geometries and flows.'],
    ['PSI-69', 'FLEX mapped the limiting oxygen index vs pressure and measured CO₂ and helium suppressant effectiveness on 274 droplet tests.'],
    ['PSI-20', 'BRE: turning off ventilation — an established step in fighting spacecraft fires — may not extinguish fires in elevated-O₂ atmospheres.'],
    ['PSI-39', 'CFI / FLEX cool flames can keep reacting after visible extinction — suppression must account for invisible low-temperature burning.']] },
  modeling: { h: 'Predict fires instead of waiting to see them', pts: [
    ['PSI-10', 'Flame Design and CFI-G provide the widest measured envelope: 12–85% O₂ and ~6–48 psia across 650+ tests.'],
    ['PSI-62', 'Flamelet-manifold CFD validated on BASS imagery reproduces concurrent flame spread.'],
    ['PSI-117', 'FLEX-based 3-D CFD maps when drafts or heating keep cool flames alive or quench them.'],
    ['PSI-25', 'BASS-II tabulates O₂, CO₂ and CO before and after each of 129 tests — ready-made validation data.']] },
}
