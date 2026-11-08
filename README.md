# OsirisZk · Mars Aerial Explorer

A physics-based simulator for designing and testing **Mars exploration drones**, built for the
NASA Space Apps Challenge 2026 (Ankara) by team **OsirisZk**. It runs on the team's own FPV flight
core (Rapier rigid-body physics at a 240 Hz fixed step) and adds switchable **Earth / Mars**
physics: planet gravity in the physics engine and aerodynamic forces computed from the local
atmosphere.

> **Status: Phase 1 of 9 (Mars physics) is complete and tested.** Rotor aerodynamics with
> Reynolds/Mach effects, the Ingenuity-style coaxial helicopter, the Mars surface and the
> mission-design game follow. See `MARS-ILERLEME.md` (Turkish) for the plan and the log.

## What Phase 1 shows

The same airframe, the same motors, the same Rapier world, only the planet changes:

| 5" FPV quad (650 g) | Earth (ISA sea level) | Mars (brief: ρ 0.020 kg/m³) | Mars (NASA mean: ρ 0.016) |
|---|---|---|---|
| Max thrust / weight | 9.54 | **0.41 (cannot take off)** | **0.33** |
| Full throttle, 2 s, from the ground | climbs 70 m | stays on the ground | stays on the ground |
| rpm needed to hover | 8 000 | 38 700 (tip Mach 1.10) | 43 400 (tip Mach 1.23) |
| Blade Reynolds number (75 % radius) | 108 000 | **2 900** | 2 300 |
| Ideal hover power (momentum theory) | 46 W | 83 W | 94 W |
| Terminal fall speed, motors off | 16 m/s | 74 m/s | 82 m/s |

None of the six core airframes (65 mm whoop to a 2.4 kg hexacopter) can take off on Mars.
Spinning faster does not help either: hovering would need supersonic blade tips, and at
Reynolds numbers of a few thousand ordinary propeller airfoils lose most of their lift-to-drag.
That is why NASA's Ingenuity uses large (1.21 m), slowly turning coaxial rotors. Phase 2 turns this
into an experiment.

Mars thrust in Phase 1 is an **upper bound**: the thrust coefficient is still held at its Earth
value (see *Assumptions*). Full numbers for every airframe and four environments:
`reports/planet-compare.csv` / `.json` (`npm run planet:compare`).

## Quick start

```bash
npm install
npm run check          # 76 tests + the 5" reference flight trace (must print "AYNI")
npm run dev:planet     # Earth / Mars flight demo in the browser
npm run planet:compare # Earth–Mars comparison → reports/planet-compare.{json,csv}
npm run bench          # physics step cost per scenario → reports/physics-bench.json
```

Demo keys: Space arm · W/S throttle · H hover · arrows tilt · A/D yaw · M mode · C camera · R reset ·
Q cut motors. Planet and airframe change while the motors are off. The demo scene uses placeholder
boxes and colours; it is **not** Mars terrain data (that is Phase 4).

## Architecture

```
src/physics, src/drone, src/controllers, …   ZSK flight core — unchanged (see docs/flight-core.md)
src/planet/
  atmosphere.js           ISA / hydrostatic layered model, NASA Glenn Mars fit, uniform; CO₂ gas data
  profiles.js             Earth and Mars profiles: every parameter with unit, status and source
  PlanetEnvironment.js    MarsEnvironment / EarthEnvironment: scenario overrides, validation, tables
  PlanetPhysics.js        MarsPhysics: Rapier world with planet gravity + aerodynamic forces/torques
  PlanetFlightPhysics.js  the flight core on a planet (gravity, density-scaled thrust and drag)
  rotorDiagnostics.js     CT conventions, tip Mach, blade Reynolds number, hover rpm and power
examples/planet/          browser demo with planet / airframe / language selection
tools/                    planet-compare, physics-bench, flighttrace (core invariance)
reports/                  generated comparison and benchmark results
```

Rules kept from the brief: the core is not rewritten or edited; physics never writes positions or
velocities (only forces and torques); rendering is decoupled from the fixed 240 Hz physics step.
On Earth at the core's reference density and gravity the planet layer reproduces the core's
reference flight trace **bit for bit** (SHA-256 of the full state at every step).

### Planet profiles

| Profile | g (m/s²) | Surface ρ (kg/m³) | T (K) | Status |
|---|---|---|---|---|
| `mars-brief` (default) | 3.71 | 0.020 | 213.15 | team brief values, cross-checked with NASA |
| `mars-nasa` | 3.73 | 0.016 | 214 | NASA Mars Fact Sheet |
| `mars-glenn` | 3.73 | 0.0150 | 242.1 | NASA Glenn MGS curve fit, as published |
| `mars-ingenuity-design-min` / `-max` | 3.73 | 0.0145 / 0.0185 | 214* | Ingenuity design range (JPL) |
| `mars-ingenuity-low-season` | 3.73 | 0.012 | 214* | lowest Jezero density expected (JPL, 2021) |
| `earth-isa` | 9.80665 | 1.225 | 288.15 | U.S. Standard Atmosphere 1976 / ISA |

\* assumed. Any value can be overridden for an experiment
(`MarsEnvironment({surfaceDensity: 0.012})`); overridden values are labelled *scenario*, and a
`uniform` model holds density constant with altitude as an experimental control.

### Validation (tests/planet-*.test.js)

- ISA table values at 0, 1, 5, 11 and 20 km; Mars scale height 11.0 km and mean molar mass 43.49 g/mol (Fact Sheet)
- Mars speed of sound inside the 235–255 m/s band of SuperCam measurements; CO₂ viscosity (Sutherland)
- hydrostatic balance dp/dh = −ρg and the ideal-gas law for every profile; agreement with the NASA Glenn fit
- free fall ½gt² on both planets, fall-time ratio √(g_E/g_M), mass independence in vacuum
- mass–weight: ground contact force = m·g on Earth and Mars
- terminal velocity and the analytic tanh solution; air-relative drag in wind
- energy: first-order convergence in vacuum, drag work closes the balance, energy never rises
- numerical stability: torque-free tumbling keeps angular momentum (Dzhanibekov flip reproduced)
- fixed step: identical state at 30/60/144/240 Hz rendering; same wind seed gives the same flight
- bit-for-bit core equivalence on Earth; Mars hover balance; Earth↔Mars switching

### Assumptions (marked *assumed* in code, reports and the demo)

1. Core airframe thrust and drag values are sea-level ISA calibrations (1.225 kg/m³).
2. CT and CQ are held at their Earth values. No Reynolds or Mach correction yet, so Mars thrust is an upper bound (Phase 2).
3. Maximum motor speed does not depend on density. There is no motor or ESC model yet (Phase 2).
4. Body drag coefficients scale linearly with density.
5. The core controller's feed-forward still uses 9.81 m/s². Its loops stay stable but respond more slowly on Mars.
6. Battery drain is the core's load model, not an electrical power model (Phase 2).
7. Aerodynamic forces act at the centre of mass. Blade chord for the Reynolds estimate is 0.1 D.

Rapier computes in 32-bit floats; tests use tolerances that reflect this (≈1e-5 relative).

## Sources

Data: [NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) ·
[NASA Glenn Mars atmosphere model](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars-atmosphere-equation-metric/) ·
[U.S. Standard Atmosphere 1976](https://ntrs.nasa.gov/citations/19770009539) ·
[NIST-JANAF CO₂ table](https://janaf.nist.gov/tables/C-095.html) ·
[Sutherland constants (White, via COMSOL)](https://doc.comsol.com/6.4/doc/com.comsol.help.cfd/cfd_ug_fluidflow_high_mach.08.46.html) ·
[H. Grip, JPL: Ingenuity density range](https://science.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/flying-on-mars-is-getting-harder-and-harder/) ·
[DLR: speed of sound on Mars](https://www.dlr.de/en/latest/news/2022/02/20220401_the-sound-of-mars).
Full list with what each source is used for: `docs/SOURCES.md`.

Software: ZSK flight core (team's own code), [Rapier](https://rapier.rs) (Apache-2.0),
[three.js](https://threejs.org) (MIT), [Vite](https://vite.dev) (MIT, development only).

## License

To be decided by the team before submission. Space Apps requires materials to be openly
available; the challenge's default is Apache-2.0.
