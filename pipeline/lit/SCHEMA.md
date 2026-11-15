# Literature measurement schema (one JSON object per measurement)
Write a JSON array to data/literature/extracted/<ntrs-id>.json. Only quantitative measurements reported in the paper (from text, tables or figure captions that state numbers). Never estimate from plots. Never invent.
```json
{
  "paper": "20200000557",                 // NTRS id (file name)
  "investigation": "Saffire-II",          // BASS, BASS-II, Saffire-I..VI, ACME BRE, SoFIE, FLEX, CFI, SAME, ... or null
  "platform": "ISS",                      // ISS | Cygnus | drop tower | parabolic flight | sounding rocket | Space Shuttle | Mir | normal-gravity lab | model/simulation
  "gravity_g": 0.0,                       // 0 for microgravity, 1 for normal gravity, fraction for partial; null if unclear
  "material": "PMMA",                     // as named: PMMA, cotton-fiberglass (SIBAL), Nomex, Kapton, silicone, filter paper, n-heptane...
  "thickness_mm": 0.2,                    // null if not stated
  "geometry": "thin sheet",               // thin sheet | thick slab | rod | cylinder | droplet | burner | wire | ...
  "flow_mode": "concurrent",              // concurrent | opposed | quiescent | null
  "flow_cm_s": 20,                        // null if not stated
  "o2_pct": 21,                           // oxygen percent by volume; null if not stated
  "pressure_kpa": 101.3,                  // convert psia*6.895 or atm*101.325 ; null if not stated
  "quantity": "flame_spread_rate",        // flame_spread_rate | flame_length | flame_width | burning_rate | mass_loss_rate | extinction_o2 | extinction_flow | flammability_limit | ignition_time | ignition_energy | heat_flux | smoke_particle_size | other
  "value": 1.2,                           // number as stated in the quote (after unit conversion only if the quote gives the unit)
  "unit": "mm/s",
  "outcome": null,
  "basis": "measured",                    // measured (this paper's experiment) | model (simulation/theory output) | estimate (extrapolated/approximate by authors) | cited (value quoted from another study)                        // for limit/test-outcome rows: "burned" | "extinguished" | "no ignition" | null
  "quote": "exact verbatim text copied from the .txt file containing the number"
}
```
Rules: `quote` must be copied character-for-character from the paper text (a sentence or one table row, 40–400 chars) and must contain the reported number. Conditions (O2, pressure, flow, thickness) may come from nearby text; put them in the fields. Prefer microgravity data, but include normal-gravity comparison values when the paper pairs them. Skip papers with no quantitative fire measurements (write `[]`).
