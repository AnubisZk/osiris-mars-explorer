// OsirisZk planet layer: Earth/Mars environments and physics on top of the ZSK flight core.
// The core files are not modified; Earth with ρ = 1.225 kg/m³ and g = 9.81 m/s² reproduces the
// core bit for bit (tests/planet-flight.test.js).
export {R_UNIVERSAL,GLENN_GAS_CONSTANT,GASES,gasData,gammaAt,sutherland,atmosphereState,layeredState,glennMarsState} from './atmosphere.js';
export {SOURCES,STATUS_LABELS,PROFILES,PROFILE_ORDER,DEFAULT_MARS,getProfile} from './profiles.js';
export {PlanetEnvironment,createEnvironment,MarsEnvironment,EarthEnvironment} from './PlanetEnvironment.js';
export {PlanetPhysics,MarsPhysics} from './PlanetPhysics.js';
export {PlanetFlightPhysics,planetizeDrone,CORE_REFERENCE,ASSUMPTIONS} from './PlanetFlightPhysics.js';
export {rotorDiagnostics,DIAGNOSTIC_LIMITS} from './rotorDiagnostics.js';
