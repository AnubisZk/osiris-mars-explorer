/** Ready-made experiments (Phase 6). Each varies one or two factors under otherwise equal conditions. */
export const EXPERIMENTS=Object.freeze({
  frames:{name:'frames',label:{en:'Frame geometry: carbon vs C60 lattice vs hex cell',tr:'Gövde geometrisi: karbon, C60 kafes, altıgen hücre'},
    base:{vehicle:'ingenuity-like',wind:{level:'summer'}},variables:[{key:'frame',values:['carbon','fullerene','hexcell']}],seeds:[1,2,3]},
  density:{name:'density',label:{en:'Air density sweep (Jezero seasons)',tr:'Hava yoğunluğu taraması (Jezero mevsimleri)'},
    base:{vehicle:'ingenuity-like'},variables:[{key:'density',values:[.010,.012,.0145,.0165,.0185,.020]}],seeds:[1]},
  vehicles:{name:'vehicles',label:{en:'Rotor systems on the same mission',tr:'Aynı görevde rotor sistemleri'},
    base:{},variables:[{key:'vehicle',values:['ingenuity-like','osiris-mars-quad','msh-hexa','fpv5']}],seeds:[1,2]},
  payload:{name:'payload',label:{en:'Payload on the OsirisZk quad',tr:'OsirisZk dörtlüsünde yük'},
    base:{vehicle:'osiris-mars-quad'},variables:[{key:'payload',values:[0,.25,.5,1,1.5]}],seeds:[1]},
  wind:{name:'wind',label:{en:'Mars wind levels',tr:'Mars rüzgâr seviyeleri'},
    base:{vehicle:'ingenuity-like'},variables:[{key:'wind',values:['calm','summer','fall','dust-storm']}],seeds:[1,2,3]},
  route:{name:'route',label:{en:'Route length vs energy',tr:'Güzergâh uzunluğu ve enerji'},
    base:{vehicle:'ingenuity-like'},variables:[{key:'route',values:['short','standard','survey']}],seeds:[1]},
  'earth-mars':{name:'earth-mars',label:{en:'Earth vs Mars: same vehicles',tr:'Dünya ve Mars: aynı araçlar'},
    base:{},variables:[{key:'profile',values:['earth-isa','mars-brief']},{key:'vehicle',values:['fpv5','ingenuity-like']}],seeds:[1]},
});
