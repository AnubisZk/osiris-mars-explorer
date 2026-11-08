# Sources

Every number in the planet layer comes from one of these, from the team brief, or is marked
*assumed*. In code the same list is `SOURCES` in `src/planet/profiles.js`; each parameter's
source key is in `PlanetEnvironment.parameters()`.

## Data and models

| Key | Source | Used for |
|---|---|---|
| `nasaFactSheet` | NASA NSSDCA, *Mars Fact Sheet* — https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | mean surface gravity 3.73 m/s²; surface density ~0.016 ± 0.006 kg/m³; pressure 6.36 mb (4.0–8.7); average temperature ~214 K; scale height 11.0 km; mean molecular weight 43.49; composition (CO₂ 95.1 %, N₂ 2.59 %, Ar 1.94 %, O₂ 0.16 %, CO 0.06 %); Viking wind ranges |
| `nasaGlenn` | NASA Glenn Research Center, *Mars Atmosphere Model – metric units* (fit to Mars Global Surveyor data) — https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars-atmosphere-equation-metric/ | the `mars-glenn` profile as published; lapse rates of the layered Mars model (−0.998 K/km below 7 km, −2.22 K/km above) |
| `isa` | *U.S. Standard Atmosphere, 1976*, NASA-TM-X-74335 — https://ntrs.nasa.gov/citations/19770009539 | Earth profile (identical to ISA below 32 km); layered hydrostatic construction |
| `janafCO2` | NIST-JANAF Thermochemical Tables, *Carbon dioxide (C-095)* — https://janaf.nist.gov/tables/C-095.html | cp(T) of CO₂ → γ of the Mars mixture (minor species: 298.15 K JANAF values) |
| `sutherlandCO2` | Sutherland constants for CO₂ (μ₀ 1.370e-5 Pa·s, T₀ 273 K, S 222 K; White, *Viscous Fluid Flow*), as tabulated in COMSOL CFD Module Table 5-2 — https://doc.comsol.com/6.4/doc/com.comsol.help.cfd/cfd_ug_fluidflow_high_mach.08.46.html | Mars gas viscosity → Reynolds numbers |
| `sutherlandAir` | Sutherland (1893); constants for air (1.716e-5 Pa·s, 273.15 K, 110.4 K) — https://www.cfd-online.com/Wiki/Sutherland_law | Earth air viscosity |
| `ingenuityDensity` | H. Grip (JPL), *Flying on Mars Is Getting Harder and Harder*, NASA, 2021 — https://science.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/flying-on-mars-is-getting-harder-and-harder/ | Ingenuity design density range 0.0145–0.0185 kg/m³; low-season 0.012 kg/m³; rotor speeds 2 537 / 2 700 / 2 800 rpm (Phase 2) |
| `marsSound` | DLR, *The sound of Mars*, 2022 (SuperCam microphone) — https://www.dlr.de/en/latest/news/2022/02/20220401_the-sound-of-mars | validation: ~240 m/s (low pitch) and ~250 m/s (high pitch) |
| `brief` | OsirisZk development brief, Phase 1 starting values | `mars-brief` profile: g 3.71 m/s², ρ 0.020 kg/m³, −60 °C (cross-checked against the Fact Sheet in each note) |

Physical constants: molar gas constant R = 8.314462618 J/(mol·K) (exact, 2019 SI); molar masses
from IUPAC standard atomic weights; standard gravity 9.80665 m/s².

Engineering relations used without a single source: ideal-gas law, hydrostatic equation, momentum
theory hover power P = T^1.5/√(2ρA) (standard rotorcraft theory, e.g. Leishman, *Principles of
Helicopter Aerodynamics*), propeller and rotorcraft thrust-coefficient conventions.

## Phase 2 reference (not used in Phase 1 code yet)

- W. Cuyler & C. Dull et al., *Hover and Forward Flight Performance Modeling of the Ingenuity Mars
  Helicopter*, NASA Ames — https://rotorcraft.arc.nasa.gov/Publications/files/Cuyler_Dull_10-Jan-22_06-00-24.pdf

## Software

| Package | License | Role |
|---|---|---|
| ZSK flight core (`src/` outside `src/planet/`) | team's own code | rigid-body flight, controller, airframes, input |
| `@dimforge/rapier3d-compat` 0.21.0 | Apache-2.0 | physics engine |
| `three` 0.186.1 | MIT | math classes, rendering in the demo |
| `vite` 8.3.4 | MIT | development server / build (dev only) |
