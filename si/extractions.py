"""SI extraction layer — authored at build time by an SI assistant from the PSI record text
(objective / approach / hypothesis / research impacts / experiment hardware) and PSI experimental tables.
Every factual field paraphrases or quotes the PSI record; anything not stated there is 'unknown'.
Scores are judgments (0-10) with a rationale citing the PSI field that supports them.
"""
U = "unknown"
X = {}
def inv(acc, **k): X[acc] = k

inv("PSI-26", short="BASS", family="BASS / solids", phase="Solid", fuels=["SIBAL (75% cotton / 25% fiberglass) fabric", "Nomex blend", "Ultem sheet", "PMMA spheres, cylinders, slabs", "Paraffin & Japan-wax candles/slabs"],
    geometry="Flat fabric sheets (1-2 cm wide), PMMA spheres (1-2 cm), cylinders/rods, slabs; in a 76 mm x 76 mm flow duct",
    o2=U + " (not tabulated in PSI table)", pressure=U + " (ISS glovebox ambient; value not tabulated)", flow="Up to 40 cm/s, opposed or concurrent (approach text)",
    gravity="Microgravity (ISS)", hardware="Microgravity Science Glovebox (MSG), small flow duct, Kanthal 29-gage wire igniter",
    sensors=["Video (top & edge views)", "Flame size/shape/color & spread rate from imagery", "Radiometer"],
    variables=["Airflow speed & direction", "Material", "Sample geometry & size", "Nitrogen suppressant application"],
    findings=["Tests the hypothesis that ventilated materials burn as well or better in microgravity than in 1 g (hypothesis text).",
              "Assessed an inert gaseous (nitrogen) extinguishing agent similar to that used on ISS (objective 2).",
              "Results feed heat-release models and link NASA-STD-6001 Test 1/Test 2 to performance-based material selection (research impacts)."],
    summary="BASS burned real spacecraft-type materials (cotton/fiberglass fabric, Nomex, PMMA shapes) in a small wind tunnel on ISS, varying airflow up to 40 cm/s, and tried putting flames out with nitrogen. It asks whether NASA's 1-g upward-burn screening test is really worst-case for space.",
    cat=dict(prevention=(9, "Directly targets material-selection screening (NASA-STD-6001 Test 1 vs microgravity flammability) - objective 1."),
             detection=(3, "Flame radiation/size data are indirect inputs to detection; no detector testing."),
             suppression=(8, "Objective 2 evaluates an inert gaseous (N2) agent 'similar to that used on ISS'."),
             modeling=(8, "Research impacts: 'Detailed combustion models are validated using the simpler flow environment'.")),
    realism=1.0, habitatNote="Real cabin materials + ventilation flows make BASS a core reference for any crewed habitat; no elevated-O2 or reduced-pressure tests recorded.",
    earth=["Better material flammability test methods", "Model validation for building/wildfire spread"], related=["PSI-25", "PSI-62", "PSI-107"])

inv("PSI-25", short="BASS-II", family="BASS / solids", phase="Solid", fuels=["PMMA films (100-200 micron), slabs, rods", "Fabrics", "Spherical sections"],
    geometry="Films, slabs, cylinders/rods, spherical sections, fabric sheets (objective 4)",
    o2="13.6-22.2% by vol (calibrated initial O2, PSI table); reduced below 21% by N2 vitiation", pressure=U + " (not tabulated)", flow="Up to 40 cm/s, opposed and concurrent (approach text)",
    gravity="Microgravity (ISS)", hardware="Microgravity Science Glovebox (MSG) wind tunnel",
    sensors=["Cameras (frames shot)", "Radiometer (gain settings)", "O2, CO2 (% vol) and CO (ppm) before/after each test"],
    variables=["Forced flow velocity (speed, direction)", "Ambient O2 via N2 vitiation", "Sample geometry & thickness"],
    findings=["Studied ignition, flame growth, spread and extinction limits of solids in low-velocity forced flow (objective 1).",
              "Bridges NASA-STD-6001 Test 1 with real microgravity flammability; seeds SoFIE science requirements (objectives 2-3).",
              "Hypothesis: upward 1-g burning may not be conservative for flammability in space."],
    summary="BASS-II extended BASS to thicker, realistic solid fuels and swept oxygen down from ~22% to ~14% while varying airflow, mapping when flames spread or go out. 129 tests are tabulated with measured O2/CO2/CO.",
    cat=dict(prevention=(9, "Seeks 'the fundamental limit for a given material' and challenges 1-g screening conservatism (hypothesis)."),
             detection=(4, "Measured CO/CO2 rise per test - useful for combustion-product detection thresholds."),
             suppression=(6, "Low-O2 extinction limits inform oxygen-reduction suppression; no agent discharge."),
             modeling=(9, "Objective text: results 'contribute to the combustion computational models used in the design of fire detection and suppression systems'.")),
    realism=1.0, habitatNote="Best PSI dataset for low-flow solid flammability limits vs O2; covers only <=22% O2, so lunar/rover 30%+ O2 is an extrapolation.",
    earth=["Wildfire/building fire model validation", "Material selection"], related=["PSI-26", "PSI-62"])

inv("PSI-98", short="Saffire-I", family="Saffire / large-scale", phase="Solid", fuels=["SIBAL cotton-fiberglass fabric"],
    geometry="Large sheet ~94 cm x 40.6 cm, 0.37 cm thick",
    o2="~21.5-21.7% (PSI table)", pressure=U + " (Cygnus cabin; not tabulated)", flow="20 cm/s, concurrent and opposed (PSI table)",
    gravity="Microgravity (uncrewed Cygnus after ISS departure)", hardware="Saffire-1 flow-duct enclosure in Cygnus",
    sensors=["2 cameras", "Thermocouples (flow, flame, plume)", "2 radiometers", "Pressure, O2 and CO2 sensors", "2 anemometers"],
    variables=["Flow direction (concurrent vs opposed)"],
    findings=["First large-scale (meter-class) spacecraft fire experiment, run without crew risk (hypothesis/approach).",
              "Measures how fast a large fire grows in low gravity vs NASA's 1-g screening test (objectives).",
              "Concurrent sample burned 420 s; opposed sample 70 s (PSI table burn times)."],
    summary="Saffire-I lit a meter-long sheet of cotton-fiberglass fabric inside an empty Cygnus cargo ship after it left the ISS, measuring flame growth, heat, O2/CO2 and pressure at realistic spacecraft scale.",
    cat=dict(prevention=(8, "Objective (2): low-g flammability limits vs NASA's normal-gravity screening test."),
             detection=(6, "Spacecraft-scale O2/CO2/pressure/temperature evolution during a real fire."),
             suppression=(4, "No suppression tested; fire growth data inform response timelines."),
             modeling=(8, "Large-scale growth data for vehicle-scale fire models.")),
    realism=1.0, habitatNote="Only PSI data at vehicle scale inside a real pressurized module - directly relevant to cabins, rovers and habitat modules.",
    earth=["Fire safety in mines, airplanes and submarines (research impacts)"], related=["PSI-99", "PSI-100", "PSI-26"])

inv("PSI-99", short="Saffire-II", family="Saffire / large-scale", phase="Solid", fuels=["Silicone (0.27-1.03 mm)", "SIBAL fabric", "PMMA (flat & structured)", "PMMA with Nomex"],
    geometry="9 samples, each 5 cm x 29 cm",
    o2="~21.5-22.1% (derived from CO2 production, PSI table note 1)", pressure=U + " (not tabulated)", flow="20 cm/s in table (approach text: 20 or 30 cm/s), concurrent/opposed",
    gravity="Microgravity (uncrewed Cygnus)", hardware="Saffire flow duct in Cygnus Pressurized Cargo Module",
    sensors=["2 cameras", "Thermocouples", "2 radiometers", "Pressure/CO2/O2 sensors", "2 anemometers"],
    variables=["Material", "Thickness", "Flow direction"],
    findings=["Silicone samples showed ~0 burn length in microgravity while some burned completely in the 1-g comparison (PSI table).",
              "PMMA flames stayed anchored at the sample base with very slow regression (0.01-0.04 mm/s) (table note 4).",
              "PMMA portion of a PMMA/Nomex sample was consumed but Nomex did not ignite (table note 2)."],
    summary="Saffire-II burned nine different spacecraft materials side-by-side in an empty Cygnus, directly comparing microgravity burn length against 1-g behavior.",
    cat=dict(prevention=(9, "Material-by-material microgravity vs 1-g burn length comparison in the PSI table."),
             detection=(5, "Cabin-scale gas and temperature records."),
             suppression=(3, "No suppression system tested."),
             modeling=(7, "Benchmark burn-length/spread data across materials.")),
    realism=1.0, habitatNote="Multi-material comparison is directly usable for habitat material down-selection.",
    earth=["Confined-space fire safety (mines, aircraft, submarines)"], related=["PSI-98", "PSI-100"])

inv("PSI-100", short="Saffire-III", family="Saffire / large-scale", phase="Solid", fuels=["SIBAL cotton-fiberglass fabric"],
    geometry="Large sheet 94 cm x 40.6 cm, 0.33 cm thick (PSI table)",
    o2=U + " (not tabulated)", pressure=U, flow="30 cm/s, concurrent and opposed (PSI table)",
    gravity="Microgravity (uncrewed Cygnus)", hardware="Saffire III enclosure in Cygnus",
    sensors=["2 cameras", "Thermocouples", "2 radiometers", "Pressure/CO2/O2 sensors", "2 anemometers"],
    variables=["Flow direction"], findings=["Repeated the large SIBAL fire at a higher 30 cm/s flow (vs 20 cm/s in Saffire-I) (approach text).",
              "Objective: large-scale fire growth rate and low-g flammability limits vs 1-g test."],
    summary="Saffire-III repeated the meter-scale fabric fire at a higher airflow (30 cm/s), giving a flow-speed comparison point with Saffire-I.",
    cat=dict(prevention=(8, "Same objectives as Saffire-I: low-g flammability limits vs NASA 1-g screening."),
             detection=(6, "Cabin-scale sensor suite (O2/CO2/pressure/temperature)."),
             suppression=(3, "No suppression tested."), modeling=(8, "Flow-speed sensitivity of large-scale spread.")),
    realism=1.0, habitatNote="Vehicle-scale fire growth at a ventilation speed typical of cabin airflows.",
    earth=["Confined-space fire safety"], related=["PSI-98", "PSI-99"])

inv("PSI-102", short="SAME", family="Smoke & aerosol", phase="Smoke (pyrolysis/smoldering)", fuels=["Teflon", "Kapton", "Silicone rubber", "Dibutyl phthalate (DBP)", "Lampwick (cellulose)"],
    geometry="Small heated samples in near-field hardware",
    o2=U, pressure=U, flow="5-10 cm/s air flow (PSI table)", gravity="Microgravity (ISS)", hardware="Microgravity Science Glovebox; Comparative Soot Diagnostic hardware; far-field box",
    sensors=["Two commercial smoke detectors (ionization & photoelectric)", "Thermophoretic samplers -> TEM particle sizing", "Mass loss", "Video"],
    variables=["Sample temperature", "Flow field", "Particle aging time", "Material"],
    findings=["Hypothesis: microgravity smoke particles grow larger (lower number density), which can change detector response or prevent alarms.",
              "Goal: quantify smoke droplet size distributions and relate them to generation/transport conditions (objective)."],
    summary="SAME overheated common spacecraft materials on ISS to make smoke and measured particle sizes and how real smoke detectors responded - the core dataset for spacecraft smoke detection.",
    cat=dict(prevention=(3, "Pyrolysis of overheated materials is an early-warning precursor, not a flammability test."),
             detection=(10, "Research impacts: 'technology for an advanced fire detector for future spacecraft'."),
             suppression=(1, "Not addressed."), modeling=(6, "Develops a numerical code for smoke droplet growth (objective).")),
    realism=0.9, habitatNote="Detector design for every crewed module depends on low-g smoke size distributions measured here.",
    earth=["Smoke detectors for submarines and underwater labs (research impacts)"], related=["PSI-101", "PSI-47", "PSI-115"])

inv("PSI-101", short="SAME-R", family="Smoke & aerosol", phase="Smoke (pyrolysis/smoldering)", fuels=["Kapton", "Teflon", "Silicone", "Pyrell (intumescent foam)", "Lampwick"],
    geometry="Heated samples (SAME hardware)",
    o2=U, pressure=U, flow="1-8.1 cm/s inlet velocity (PSI table); also no-flow heating", gravity="Microgravity (ISS)", hardware="SAME hardware; M-pass instrument; DustTrak; ionization detector",
    sensors=["M-pass (GRC)", "DustTrak", "Ionization detector", "Thermal precipitators"],
    variables=["Inlet velocity", "Heating temperature", "Aging/mixing time", "Material"],
    findings=["Completed 66 test points July 16 - Sept 9, 2010 (approach).", "Added Pyrell foam, higher heating temperatures and no-flow heating (approach).",
              "Validated the lognormal distribution assumption used by the moment method (approach)."],
    summary="SAME-R re-flew SAME with new materials, hotter heating and a new instrument to fix contamination problems and broaden smoke-detection data.",
    cat=dict(prevention=(3, "Overheat precursor data only."), detection=(10, "Research impacts: baseline 'against which future detection technology developments can be evaluated'."),
             suppression=(1, "Not addressed."), modeling=(6, "Lognormal moment-method validation supports smoke models.")),
    realism=0.9, habitatNote="Extends detector-relevant smoke data to more materials and no-flow conditions (relevant to low-ventilation habitats).",
    earth=["Detectors for extreme environments"], related=["PSI-102", "PSI-47"])

inv("PSI-47", short="DAFT / DAFT-2", family="Smoke & aerosol", phase="Aerosol (dust surrogate)", fuels=["Arizona Road Dust (ARD fine) aerosol in GN2 (non-combustion surrogate)"],
    geometry="Aerosol in 15 L Mylar bags", o2="not applicable", pressure="not applicable", flow="not applicable",
    gravity="Microgravity (ISS)", hardware="Modified TSI P-Trak, DustTrak",
    sensors=["Modified TSI P-Trak condensation particle counter", "DustTrak"], variables=["Instrument", "Sampling location"],
    findings=["Demonstrated a P-Trak modified to recycle isopropanol by capillary forces works in microgravity (objectives/approach).",
              "De-risked instruments used in SAME (objective)."],
    summary="DAFT proved that a commercial particle counter could be modified to work without gravity, enabling the SAME smoke measurements.",
    cat=dict(prevention=(1, "Not addressed."), detection=(8, "Research impacts: 'novel fire and smoke detection systems for the ISS and future spacecraft'."),
             suppression=(0, "Not addressed."), modeling=(2, "Instrument validation only.")),
    realism=0.7, habitatNote="Instrument-qualification heritage for detectors in any low-g habitat; lunar dust monitoring is a possible analog (our inference).",
    earth=["Particle instruments for submarines/underwater labs"], related=["PSI-102"])

inv("PSI-69", short="FLEX", family="Droplets (MDCA)", phase="Liquid droplet", fuels=["Methanol", "Heptane"],
    geometry="Isolated droplets ~1.5-5 mm initial diameter (tethered or free)", o2="12-34% mole fraction (PSI table)", pressure="0.69-3.05 atm (PSI table; approach: 0.5-1.5 atm LOI tests)",
    flow="Quiescent", gravity="Microgravity (ISS)", hardware="Multi-user Droplet Combustion Apparatus (MDCA) in Combustion Integrated Rack (CIR)",
    sensors=["Droplet diameter imaging", "Flame imaging", "Radiometers", "Soot & temperature measurement"],
    variables=["Ambient pressure", "O2 mole fraction", "Suppressant CO2 (0-0.70 mole fraction) / He (0-0.45) per PSI table", "Droplet size", "Fuel"],
    findings=["Maps the Limiting Oxygen Index vs pressure and suppressant (approach).", "Measures effectiveness of gaseous suppressants CO2, He (objective).",
              "Discovered low-temperature 'cool flame' burning after radiative extinction (research impacts mention cool flames)."],
    summary="FLEX burned ~274 fuel droplets on ISS across oxygen 12-34% and pressures ~0.7-3 atm, mapping the lowest oxygen that sustains burning and how well CO2 and helium suppress flames.",
    cat=dict(prevention=(6, "Limiting Oxygen Index vs pressure defines safe atmospheres for liquids."),
             detection=(2, "Not a detection study."), suppression=(9, "Objective: 'measure the effectiveness of various gaseous fire suppressants such as CO2, He, and SF6'."),
             modeling=(9, "Objective: 'develop reliable predictive models for combustion limits under reduced gravity'.")),
    realism=0.6, habitatNote="Pressure/O2 sweep spans 34% O2 and sub-atmospheric pressure - closest liquid-fuel data to lunar/rover atmospheres.",
    earth=["Cleaner suppression agents", "Engine/fuel science (cool flames)"], related=["PSI-68", "PSI-39", "PSI-117", "PSI-142"])

inv("PSI-68", short="FLEX-2", family="Droplets (MDCA)", phase="Liquid droplet", fuels=["Iso-octane", "n-octane", "Heptane", "Decane", "Ethanol", "Propanol/glycerol mixtures", "Heptane/iso-octane"],
    geometry="Droplets 1.5-5 mm, single and arrays", o2="0.17-0.30 mole fraction in table (approach: 0.1-0.4)", pressure="0.5-3.0 atm",
    flow="0.1-5 cm/s (droplet translation)", gravity="Microgravity (ISS)", hardware="MDCA in Combustion Integrated Rack (CIR)",
    sensors=["Color & B/W cameras", "Chamber pressure & temperature", "Soot imaging"], variables=["Fuel/mixture", "O2", "Pressure", "Diluent N2 or He", "Flow velocity", "Droplet size/array"],
    findings=["Studied extinction mechanisms and boundaries, soot shells and droplet interactions (objectives 3-5).", "Benchmark bi-component droplet data for model validation (objective 6)."],
    summary="FLEX-2 extended FLEX to real-fuel surrogates and mixtures, with slow forced flow and droplet arrays, across 17-30% O2 and 0.5-3 atm.",
    cat=dict(prevention=(5, "Flammability limits of droplet arrays (objective 5)."), detection=(2, "Not addressed."),
             suppression=(6, "Extinction boundaries with N2/He diluents."), modeling=(9, "Primary goal: benchmark data to validate simulations.")),
    realism=0.6, habitatNote="Covers 30% O2 and 0.5 atm, bracketing lunar-base atmospheres for liquid fuels (lubricants, cleaning fluids by analogy).",
    earth=["Jet engine and surrogate fuel models"], related=["PSI-69", "PSI-39"])

inv("PSI-39", short="CFI", family="Droplets (MDCA)", phase="Liquid droplet", fuels=["n-dodecane", "n-dodecane/iso-dodecane", "Farnesane"],
    geometry="Droplets on needles or SiC fibers", o2="17-21% (PSI table)", pressure="0.5-5 atm (PSI table)", flow="Quiescent",
    gravity="Microgravity (ISS)", hardware="MDCA in Combustion Integrated Rack (CIR)",
    sensors=["B/W droplet camera", "UV OH* camera", "Narrow & wide-band radiometers"], variables=["Pressure", "He dilution", "Droplet size", "Fuel"],
    findings=["Examines cool-flame behavior and extinction diameters vs pressure (objectives).", "Helium dilution effects on cool flames (objective 2)."],
    summary="CFI studied low-temperature 'cool flames' of jet-fuel-like droplets across 0.5-5 atm, important for understanding unexpected re-ignition and low-temperature chemistry.",
    cat=dict(prevention=(4, "Cool flames can persist after visible extinction - a hidden ignition risk."), detection=(3, "OH* imaging of near-invisible flames."),
             suppression=(4, "Extinction diameters and He dilution."), modeling=(8, "Validation for low-temperature kinetic mechanisms (research impacts).")),
    realism=0.5, habitatNote="Cool-flame persistence matters where flames look extinguished but are not; O2 tested only up to 21%.",
    earth=["HCCI engines, fuel octane/cetane understanding"], related=["PSI-69", "PSI-117", "PSI-142"])

inv("PSI-20", short="ACME BRE", family="ACME (CIR)", phase="Gas burner emulating solids", fuels=["C2H4/N2", "CH4/N2 mixtures"],
    geometry="Porous circular burners, 25 and 50 mm diameter", o2="21-40% (PSI table)", pressure="Targeted 14.7, 10.2 and 8.2 psia exploration atmospheres (objective); table pressures not listed",
    flow="Quiescent (no ventilation)", gravity="Microgravity (ISS)", hardware="ACME in Combustion Integrated Rack (CIR)",
    sensors=["Heat-flux sensor", "Burner surface temperature", "Cameras"], variables=["O2 concentration", "Pressure", "Fuel mixture/flow rate", "Burner size"],
    findings=["Quasi-steady burning emulating PMMA and nylon was observed without any airflow (research impacts).",
              "In elevated-O2 atmospheres flames kept burning without flow, whereas 21% O2 flames self-extinguished quickly (research impacts).",
              "Suggests greater use of NASA cone-calorimeter Test 2 for material flammability maps (research impacts)."],
    summary="BRE used a gas burner to mimic burning solids under the exact atmospheres planned for exploration (up to 34-40% O2 at reduced pressure). Key result: turning off ventilation - a standard step in fighting spacecraft fires - may not put fires out at elevated oxygen.",
    cat=dict(prevention=(10, "Directly tests exploration atmospheres (10.2 psia/26.5%, 8.2 psia/34%) named in the objective."),
             detection=(3, "Not a detection study."), suppression=(9, "Shows ventilation shutdown may fail in elevated O2 (research impacts)."),
             modeling=(8, "Links burning conditions to material properties (heat of gasification, smoke point) - hypothesis.")),
    realism=0.8, habitatNote="The single most lunar-base-relevant PSI investigation: elevated O2 at reduced pressure, quiescent flow.",
    earth=["Cone-calorimeter based material flammability maps"], related=["PSI-10", "PSI-159"])

inv("PSI-10", short="ACME Flame Design", family="ACME (CIR)", phase="Gas", fuels=["Ethylene (C2H4)", "Methane (CH4)", "N2/CO2 diluents"],
    geometry="Spherical porous burner, normal and inverse flames; coflow", o2="19.8-85% (XO2 in PSI tables)", pressure="0.43-3.0 atm (PSI tables)",
    flow="Quiescent spherical flames (fuel/oxidizer flow rate varied)", gravity="Microgravity (ISS) + drop towers", hardware="ACME in Combustion Integrated Rack (CIR)",
    sensors=["Cameras", "Radiometers", "Photomultiplier tubes", "Thermocouples"], variables=["Flow rate", "Stoichiometric mixture fraction Zst", "Inert amount (N2/CO2)", "Pressure"],
    findings=["Soot-inception and extinction limits for normal and inverse spherical flames (objectives A, C).", "Hypothesis: spherical flames extinguish when peak temperature drops below ~1130 K."],
    summary="Flame Design mapped when flames make soot and when they go out over a very wide oxygen (20-85%) and pressure (0.4-3 atm) range - over 320 tabulated tests.",
    cat=dict(prevention=(5, "Extinction limits vs O2 and pressure."), detection=(4, "Soot-inception limits relate to smoke production."),
             suppression=(5, "Inert dilution (N2/CO2) extinction limits."), modeling=(8, "Detailed kinetic/soot model validation.")),
    realism=0.4, habitatNote="Widest measured O2-pressure envelope in PSI, spanning lunar-base atmospheres, but for gaseous fuels.",
    earth=["Cleaner, more efficient combustors / power plants"], related=["PSI-159", "PSI-20"])

inv("PSI-159", short="ACME CFI-G", family="ACME (CIR)", phase="Gas", fuels=["Ethane", "Propane", "n-butane", "n-pentane"],
    geometry="Spherical porous burner, normal & inverse flames", o2="12-85% (PSI tables)", pressure="0.49-3.27 atm (PSI tables, bar converted)",
    flow="Quiescent", gravity="Microgravity (ISS)", hardware="ACME in Combustion Integrated Rack (CIR)",
    sensors=["Cameras", "Radiometers", "Photomultiplier tubes", "Thermocouples", "Burner temperature"], variables=["Fuel", "Zst", "Adiabatic flame temperature", "Flow rate", "Pressure"],
    findings=["First steady cool diffusion flames on spherical burners (hypotheses 1-4).", "Cool flames can transition to hot flames when flow increases (hypothesis 5).",
              "Tests recorded up to 85% O2 (PSI table)."],
    summary="CFI-G created 'cool flames' (500-1000 K) of gaseous fuels across 12-85% O2, showing flames that are hard to see can still be burning and can jump back to hot flames.",
    cat=dict(prevention=(5, "Defines cool-flame regimes at very high O2."), detection=(5, "Near-invisible cool flames challenge optical detection."),
             suppression=(4, "Extinction vs flow-rate behavior."), modeling=(8, "Kinetic mechanism validation (objective 4).")),
    realism=0.4, habitatNote="Very-high-O2 data (up to 85%) relevant to O2-rich zones like suit-loop and pre-breathe environments.",
    earth=["Ultra-lean high-efficiency engines"], related=["PSI-10", "PSI-39"])

inv("PSI-23", short="ACME s-Flame", family="ACME (CIR)", phase="Gas", fuels=["H2", "CH4", "C2H4", "N2/He/CO2 diluents"],
    geometry="Spherical porous burner", o2="~21% and ~30% (PSI table)", pressure="~1 atm (table note)", flow="Quiescent",
    gravity="Microgravity (ISS)", hardware="ACME in Combustion Integrated Rack (CIR)",
    sensors=["Spectrally resolved images", "Flame & burner temperatures", "Radiative flux", "Acceleration levels"], variables=["Fuel/diluent ratio", "Flow rate", "Ambient O2"],
    findings=["Measured convective and radiative extinction limits (objective B).", "Searched for pulsating instabilities (objective C)."],
    summary="s-Flame grew spherical flames of hydrogen, methane and ethylene at ~21% and ~30% O2 to test detailed chemistry and radiation models.",
    cat=dict(prevention=(4, "Extinction limits incl. ~30% O2."), detection=(2, "Not addressed."), suppression=(4, "Diluent effects on extinction."), modeling=(8, "Rigorous test of detailed models (hypothesis).")),
    realism=0.4, habitatNote="Includes ~30% O2 cases, matching the lunar-base O2 level at ~1 atm.",
    earth=["Engine efficiency/emissions"], related=["PSI-10"])

inv("PSI-21", short="ACME CLD Flame", family="ACME (CIR)", phase="Gas", fuels=["Methane", "Ethylene", "N2-diluted"],
    geometry="Coflow burner", o2=U, pressure=U, flow="Weak coflow (velocity varied; values not tabulated)", gravity="Microgravity (ISS)", hardware="ACME in Combustion Integrated Rack (CIR)",
    sensors=["OH*/CH* chemiluminescence", "Thin-filament pyrometry", "Soot luminosity", "Laser extinction (soot volume fraction)"], variables=["Coflow velocity", "Fuel dilution"],
    findings=["Characterizes lift-off, extinction limits and sooting tendency vs velocity and dilution (objectives A, B)."],
    summary="CLD Flame measured weak coflow flames from near-extinction to heavily sooting to improve soot models used in fire simulations.",
    cat=dict(prevention=(3, "Indirect."), detection=(4, "Soot formation relevant to smoke signatures."), suppression=(5, "Research impacts: extinction understanding 'critical in the suppression of fires'."), modeling=(8, "Model validation is the core aim.")),
    realism=0.4, habitatNote="Soot/extinction model data; conditions (O2/pressure) not tabulated in PSI.", earth=["Engine and soot modeling"], related=["PSI-22", "PSI-60"])

inv("PSI-22", short="ACME E-FIELD Flames", family="ACME (CIR)", phase="Gas", fuels=["Methane", "Ethylene", "N2-diluted"],
    geometry="Gas-jet and coflow burners with mesh electrode", o2=U, pressure=U, flow="With and without weak air coflow", gravity="Microgravity (ISS); electric field used to mimic buoyancy (partial-gravity analog per challenge brief)",
    hardware="ACME in Combustion Integrated Rack (CIR); up to 10 kV electrode", sensors=["Ion current", "Flame imaging", "Soot evaluation"], variables=["Field voltage & polarity", "Fuel concentration"],
    findings=["Relates field voltage to chemi-ion current and flame response time (objective).", "Ion-driven convection can stand in for buoyancy - useful as a partial-gravity analog."],
    summary="E-FIELD used electric fields to push flames around via their ions - a way to impose an artificial 'wind' or buoyancy-like force in microgravity.",
    cat=dict(prevention=(3, "Indirect."), detection=(4, "Chemi-ion current is a potential flame-sensing signal (our inference)."), suppression=(5, "Electric field flame control could inform novel suppression (inference)."), modeling=(6, "Buoyancy-free ion convection data.")),
    realism=0.3, habitatNote="Only PSI investigation that mimics partial-gravity buoyancy effects; relevant to lunar/Mars interpolation.", earth=["Lower-emission combustion control"], related=["PSI-21", "PSI-23"])

inv("PSI-107", short="SPICE", family="Glovebox flames", phase="Gas (jet)", fuels=["Methane", "Ethylene", "Propane", "Propylene", "Propylene mixtures"],
    geometry="Jet nozzles 0.41, 0.76, 1.6 mm in coflow duct", o2="Air (21%, coflow)", pressure=U + " (not tabulated)", flow="Coflow 5.4-65 cm/s (approach); table records 0.66-85 cm/s",
    gravity="Microgravity (ISS)", hardware="Microgravity Science Glovebox (MSG) with SPICE flow duct",
    sensors=["Still & video cameras", "Flame length", "Radiative heat loss", "Coflow velocity"], variables=["Fuel", "Nozzle diameter", "Coflow velocity", "Fuel flow rate"],
    findings=["526 flames studied (approach).", "Laminar smoke points of non-buoyant flames vs coflow and burner diameter (objectives)."],
    summary="SPICE found the 'smoke point' - when a flame starts releasing soot - for 526 flames in space, key for knowing how smoky an accidental fire will be.",
    cat=dict(prevention=(4, "Sooting propensity of fuels."), detection=(7, "Smoke-point data relate fire size to smoke production for detectors."), suppression=(2, "Not addressed."), modeling=(8, "Model validation for non-buoyant flames.")),
    realism=0.4, habitatNote="Smoke-yield data inform detector sensitivity in any crewed module.", earth=["Fuel formulation, soot reduction"], related=["PSI-106", "PSI-60", "PSI-26"])

inv("PSI-106", short="SLICE", family="Glovebox flames", phase="Gas (jet)", fuels=["CH4 (100%, 70%, 40%)", "C2H4 20%", "C2H6", "C3H8"],
    geometry="Exchangeable burner tubes in fan-driven flow duct", o2="Air coflow (21%)", pressure=U, flow="Controlled coflow (values not tabulated)",
    gravity="Microgravity (ISS)", hardware="SLICE apparatus (fan-driven flow duct) in glovebox", sensors=["High-resolution camera (>4,000 images)", "Flow & temperature sensors"],
    variables=["Fuel & dilution", "Burner diameter", "Coflow velocity"], findings=["Lift-off velocity limits for fuels/burners (objective 2).", ">4,000 images across 13 test days (approach)."],
    summary="SLICE studied what keeps a flame attached to its burner versus lifting off and blowing out in microgravity.",
    cat=dict(prevention=(3, "Indirect."), detection=(3, "Indirect."), suppression=(5, "Lift-off/blow-off limits inform flow-based extinguishment."), modeling=(7, "Validate flame stability models.")),
    realism=0.4, habitatNote="Flame stabilization/blow-off insight; conditions mostly air.", earth=["Cleaner burners and engines"], related=["PSI-107"])

inv("PSI-60", short="SPICE data analysis", family="Ground analysis", phase="Computational/ground", fuels=["SPICE fuels (ethylene etc.)"],
    geometry="Yale & ACME burner configurations", o2="As in SPICE", pressure="As in SPICE", flow="As in SPICE", gravity="Computation for 1 g and 0 g",
    hardware="Ground (image processing + CFD)", sensors=["Color-ratio pyrometry of >1,600 DSLR images"], variables=["Soot model parameters", "Gravity"],
    findings=["Derived soot temperature and volume fraction fields from SPICE images (approach).", "Sensitivity analysis of soot evolution parameters."],
    summary="A ground study re-using SPICE images to extract soot temperature and concentration and improve soot models in 0 g vs 1 g.",
    cat=dict(prevention=(2, "Indirect."), detection=(5, "Research impacts: supports 'safer fire detection'."), suppression=(2, "Indirect."), modeling=(9, "Core aim is model improvement.")),
    realism=0.4, habitatNote="Shows PSI data reuse for predictive soot models.", earth=["Emission reduction"], related=["PSI-107"])

inv("PSI-62", short="BASS flame-spread modeling", family="Ground analysis", phase="Computational/ground", fuels=["PMMA sheets, spheres, rods", "Wax cylinders"],
    geometry="BASS geometries", o2="As in BASS/BASS-II", pressure="As in BASS/BASS-II", flow="Concurrent flow", gravity="Computation, 0 g and 1 g",
    hardware="Ground (CFD + two-color tomography)", sensors=["Two-color tomography of BASS DSLR imagery"], variables=["Geometry", "Flow"],
    findings=["Unsteady flamelet-generated-manifold model aimed at reproducing the 'Goldilocks' flammability zone (approach).", "Goal: predict flammability limits of spacecraft materials and provide LES subgrid models (objective)."],
    summary="A modeling grant that turned BASS videos into 3D soot/temperature fields and built a predictive flame-spread model for spacecraft materials.",
    cat=dict(prevention=(7, "Research impacts: 'predictive tools for screening new materials' flammability limits'."), detection=(2, "Indirect."), suppression=(3, "Indirect."), modeling=(10, "Predictive modeling is the whole objective.")),
    realism=0.8, habitatNote="Predictive tool path from microgravity data to new habitat materials.", earth=["Fire safety standards"], related=["PSI-25", "PSI-26"])

inv("PSI-115", short="SAME smoke simulation", family="Ground analysis", phase="Computational/ground", fuels=["Dibutyl phthalate (DBP) pyrolysis vapor"],
    geometry="SAME-like geometry", o2="not applicable", pressure="not applicable", flow="Two low cross-flow velocities", gravity="Simulation, 0 g vs 1 g",
    hardware="Ground (direct numerical simulation)", sensors=["Simulated particle size distributions"], variables=["Gravity", "Cross-flow speed", "Thermophoresis/settling"],
    findings=["Quantifies microgravity vs Earth smoke differences and the fluid mechanisms behind them (objective)."],
    summary="Simulations explaining why smoke particles grow differently in microgravity, supporting better detector design.",
    cat=dict(prevention=(2, "Indirect."), detection=(8, "Research impacts: 'directly lead to better smoke detection devices'."), suppression=(1, "Not addressed."), modeling=(8, "DNS of smoke growth.")),
    realism=0.7, habitatNote="Helps translate detector behavior to partial-gravity buoyancy levels.", earth=["Smoke detection"], related=["PSI-102"])

inv("PSI-117", short="Cool-flame CFD (FLEX)", family="Ground analysis", phase="Computational/ground", fuels=["n-alkane droplets"],
    geometry="Droplets 0.5-4 mm", o2="As in FLEX (incl. ozone-assisted cases)", pressure="Parameter sweeps", flow="Imposed convection/drift", gravity="Simulation, microgravity",
    hardware="Ground (OpenFOAM 3-D CFD)", sensors=["Simulated observables (ignition delay, extinction diameter)"], variables=["Forcing mode", "Ambient composition", "Pressure"],
    findings=["Stability maps for cool-flame onset, persistence and quenching validated against FLEX (approach)."],
    summary="3-D CFD built on FLEX data showing how small drafts or heat sources keep cool flames alive or kill them.",
    cat=dict(prevention=(4, "'Defines safer operating envelopes' (research impacts)."), detection=(2, "Indirect."), suppression=(4, "Quenching conditions."), modeling=(9, "Validated CFD tool.")),
    realism=0.5, habitatNote="Ventilation drift effects on lingering flames.", earth=["Engine knock/efficiency"], related=["PSI-69"])

inv("PSI-142", short="Cool-flame counterflow", family="Ground analysis", phase="Computational/ground", fuels=["n-heptane", "Dimethyl ether (DME)", "Large n-alkanes"],
    geometry="Counterflow flames", o2="Varied (oxygen concentration effects)", pressure="Up to 20 atm (simulated)", flow="Counterflow (strain)", gravity="1 g lab + simulation",
    hardware="PI laboratory hardware", sensors=["Extinction limits", "Flame temperature", "Species distributions"], variables=["O2", "Dilution", "Pressure", "Strain"],
    findings=["Warm flames have a double reaction-zone structure linking cool and hot flames (research impacts).", "Cool/warm flammable region expands with pressure."],
    summary="Ground experiments and simulations that connect FLEX's surprising cool flames to general flammability-limit diagrams.",
    cat=dict(prevention=(4, "Flammability-limit diagrams for cool flames."), detection=(2, "Indirect."), suppression=(4, "Extinction limits."), modeling=(8, "Kinetic/radiation model data.")),
    realism=0.4, habitatNote="Fundamental limit diagrams; not habitat-specific.", earth=["High-pressure engines"], related=["PSI-69", "PSI-117"])

EXCLUDED = {"PSI-108": "STDCE-1 - thermocapillary fluid physics (matched 'combustion' only in text)",
            "PSI-181": "Solder microstructure (materials science; matched 'combustion' only in text)"}
