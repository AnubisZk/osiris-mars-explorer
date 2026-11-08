/**
 * Planet profiles: scenario parameters, not universal constants. Every parameter carries its
 * unit, status and source so the UI and reports can show where a number comes from.
 *
 * Status values
 * - sourced  : taken from a cited standard or NASA/JPL source
 * - brief    : the OsirisZk development brief's starting value (cross-checked in `note`)
 * - assumed  : not validated against measurements ("varsayımsal"), must be shown as such
 * - derived  : computed from other parameters
 * - scenario : changed by the user for an experiment
 */
export const SOURCES=Object.freeze({
  brief:{title:'OsirisZk – Mars Aerial Explorer development brief, Phase 1 starting values',url:null},
  nasaFactSheet:{title:'NASA NSSDCA – Mars Fact Sheet',url:'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'},
  nasaGlenn:{title:'NASA Glenn Research Center – Mars Atmosphere Model, metric units (MGS data fit)',url:'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars-atmosphere-equation-metric/'},
  isa:{title:'U.S. Standard Atmosphere, 1976 (NASA-TM-X-74335); identical to ISA below 32 km',url:'https://ntrs.nasa.gov/citations/19770009539'},
  janafCO2:{title:'NIST-JANAF Thermochemical Tables – Carbon dioxide, C-095',url:'https://janaf.nist.gov/tables/C-095.html'},
  sutherlandCO2:{title:'Sutherland constants for CO₂ (White, Viscous Fluid Flow) as tabulated in COMSOL CFD Module Table 5-2',url:'https://doc.comsol.com/6.4/doc/com.comsol.help.cfd/cfd_ug_fluidflow_high_mach.08.46.html'},
  sutherlandAir:{title:'Sutherland (1893), constants for air – CFD-Online reference',url:'https://www.cfd-online.com/Wiki/Sutherland_law'},
  ingenuityDensity:{title:'H. Grip (JPL), “Flying on Mars Is Getting Harder and Harder”, NASA, 2021',url:'https://science.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/flying-on-mars-is-getting-harder-and-harder/'},
  marsSound:{title:'DLR – The sound of Mars (SuperCam microphone, 2022): ~240 m/s and ~250 m/s',url:'https://www.dlr.de/en/latest/news/2022/02/20220401_the-sound-of-mars'},
});

export const STATUS_LABELS=Object.freeze({
  sourced:{en:'sourced',tr:'kaynaklı'},brief:{en:'brief value',tr:'talimat değeri'},
  assumed:{en:'assumed',tr:'varsayımsal'},derived:{en:'derived',tr:'türetilmiş'},scenario:{en:'scenario',tr:'senaryo'},
});

const meta=(unit,status,source,note=null)=>Object.freeze({unit,status,source,note});

// Mars lapse rates from the NASA Glenn fit (dT/dh, K/m); boundary at 7 km as in that model
const MARS_LAYERS=Object.freeze([Object.freeze({base:0,lapse:-.000998}),Object.freeze({base:7000,lapse:-.00222})]);
const ISA_LAYERS=Object.freeze([
  Object.freeze({base:0,lapse:-.0065}),Object.freeze({base:11000,lapse:0}),
  Object.freeze({base:20000,lapse:.001}),Object.freeze({base:32000,lapse:.0028}),
]);
const marsLayerMeta=meta('K/m','sourced','nasaGlenn','Lapse −0.998 K/km to 7 km, −2.22 K/km above (NASA Glenn fit)');

// Mars winds (Viking Lander sites, NASA Fact Sheet ranges); preset speed = range midpoint (derived)
const MARS_WINDS=Object.freeze([
  Object.freeze({id:'calm',label:{en:'Calm',tr:'Sakin'},speed:0,gust:0,turbulence:0,range:[0,0]}),
  Object.freeze({id:'summer',label:{en:'Summer · 2–7 m/s',tr:'Yaz · 2–7 m/sn'},speed:4.5,gust:2.5,turbulence:.6,range:[2,7]}),
  Object.freeze({id:'fall',label:{en:'Fall · 5–10 m/s',tr:'Sonbahar · 5–10 m/sn'},speed:7.5,gust:2.5,turbulence:1,range:[5,10]}),
  Object.freeze({id:'dust-storm',label:{en:'Dust storm · 17–30 m/s',tr:'Toz fırtınası · 17–30 m/sn'},speed:23.5,gust:6.5,turbulence:2,range:[17,30]}),
]);
const marsWindMeta=meta('m/s','derived','nasaFactSheet','Viking Lander ranges; speed is the range midpoint, gust and turbulence amplitudes are assumed');

function profile(spec){return Object.freeze({...spec,params:Object.freeze(spec.params),meta:Object.freeze(spec.meta)});}

const marsBase=(params,metaOverrides)=>({
  planet:'mars',model:'layers',gas:'mars-co2',winds:MARS_WINDS,windMeta:marsWindMeta,
  params:{layers:MARS_LAYERS,surfacePressure:null,...params},
  meta:{layers:marsLayerMeta,...metaOverrides},
});

export const PROFILES=Object.freeze({
  'earth-isa':profile({
    id:'earth-isa',planet:'earth',label:{en:'Earth · ISA sea level',tr:'Dünya · ISA deniz seviyesi'},
    model:'layers',gas:'earth-air',winds:null,windMeta:null,
    params:{gravity:9.80665,surfaceTemperature:288.15,surfacePressure:101325,surfaceDensity:null,layers:ISA_LAYERS},
    meta:{
      gravity:meta('m/s²','sourced','isa','Standard gravity g₀ (also the brief\'s Earth value)'),
      surfaceTemperature:meta('K','sourced','isa','15 °C'),surfacePressure:meta('Pa','sourced','isa'),
      layers:meta('K/m','sourced','isa','ISA layers to 47 km'),
    },
  }),
  'mars-brief':profile({
    id:'mars-brief',label:{en:'Mars · brief defaults',tr:'Mars · talimat varsayılanı'},
    ...marsBase({gravity:3.71,surfaceDensity:.020,surfaceTemperature:213.15},{
      gravity:meta('m/s²','brief','brief','NASA Fact Sheet mean surface gravity is 3.73 m/s²'),
      surfaceDensity:meta('kg/m³','brief','brief','NASA Fact Sheet: ~0.016 ± 0.006 kg/m³; Ingenuity design range 0.0145–0.0185'),
      surfaceTemperature:meta('K','brief','brief','−60 °C; NASA Fact Sheet average ~214 K (−59 °C)'),
    }),
  }),
  'mars-nasa':profile({
    id:'mars-nasa',label:{en:'Mars · NASA Fact Sheet mean',tr:'Mars · NASA bilgi sayfası ortalaması'},
    ...marsBase({gravity:3.73,surfaceDensity:.016,surfaceTemperature:214},{
      gravity:meta('m/s²','sourced','nasaFactSheet','Mean surface gravity'),
      surfaceDensity:meta('kg/m³','sourced','nasaFactSheet','~0.016 ± 0.006 kg/m³; surface pressure 6.36 mb at mean radius, 4.0–8.7 mb by season'),
      surfaceTemperature:meta('K','sourced','nasaFactSheet','Average ~214 K; diurnal 184–242 K at Viking 1'),
    }),
  }),
  'mars-glenn':profile({
    id:'mars-glenn',planet:'mars',label:{en:'Mars · NASA Glenn MGS model',tr:'Mars · NASA Glenn MGS modeli'},
    model:'nasa-glenn',gas:'mars-co2',winds:MARS_WINDS,windMeta:marsWindMeta,
    // Surface values are those of the published fit at h = 0 (filled in by PlanetEnvironment)
    params:{gravity:3.73,surfaceTemperature:null,surfacePressure:null,surfaceDensity:null,layers:null},
    meta:{gravity:meta('m/s²','sourced','nasaFactSheet','The Glenn fit does not use g; mean surface gravity from the Fact Sheet')},
  }),
  'mars-ingenuity-design-min':profile({
    id:'mars-ingenuity-design-min',label:{en:'Mars · Ingenuity design minimum density',tr:'Mars · Ingenuity tasarım alt yoğunluğu'},
    ...marsBase({gravity:3.73,surfaceDensity:.0145,surfaceTemperature:214},{
      gravity:meta('m/s²','sourced','nasaFactSheet'),
      surfaceDensity:meta('kg/m³','sourced','ingenuityDensity','Lower end of the 0.0145–0.0185 kg/m³ design range'),
      surfaceTemperature:meta('K','assumed','nasaFactSheet','Fact Sheet average; Jezero flight temperatures not used here'),
    }),
  }),
  'mars-ingenuity-design-max':profile({
    id:'mars-ingenuity-design-max',label:{en:'Mars · Ingenuity design maximum density',tr:'Mars · Ingenuity tasarım üst yoğunluğu'},
    ...marsBase({gravity:3.73,surfaceDensity:.0185,surfaceTemperature:214},{
      gravity:meta('m/s²','sourced','nasaFactSheet'),
      surfaceDensity:meta('kg/m³','sourced','ingenuityDensity','Upper end of the 0.0145–0.0185 kg/m³ design range'),
      surfaceTemperature:meta('K','assumed','nasaFactSheet','Fact Sheet average; Jezero flight temperatures not used here'),
    }),
  }),
  'mars-ingenuity-low-season':profile({
    id:'mars-ingenuity-low-season',label:{en:'Mars · Jezero low-density season',tr:'Mars · Jezero düşük yoğunluk mevsimi'},
    ...marsBase({gravity:3.73,surfaceDensity:.012,surfaceTemperature:214},{
      gravity:meta('m/s²','sourced','nasaFactSheet'),
      surfaceDensity:meta('kg/m³','sourced','ingenuityDensity','“Densities as low as 0.012 kg/m³” expected in Jezero (2021)'),
      surfaceTemperature:meta('K','assumed','nasaFactSheet','Fact Sheet average; Jezero flight temperatures not used here'),
    }),
  }),
});
export const PROFILE_ORDER=Object.freeze(['mars-brief','mars-nasa','mars-glenn','mars-ingenuity-design-min','mars-ingenuity-design-max','mars-ingenuity-low-season','earth-isa']);
export const DEFAULT_MARS='mars-brief';
export function getProfile(id){
  const p=PROFILES[id];if(!p)throw new RangeError(`Unknown planet profile '${id}'. Known: ${PROFILE_ORDER.join(', ')}`);
  return p;
}
