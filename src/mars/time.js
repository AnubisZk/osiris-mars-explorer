/**
 * Mars solar time and Sun position (Mars24 algorithm, Allison & McEwen 2000, as implemented in
 * NASA GISS Mars24 and the open pyMarsTime code), plus Earth–Mars distance and one-way light time
 * from the JPL "Keplerian elements for approximate positions of the major planets" (1800–2050).
 * Longitudes are planetocentric EAST for the public API (converted internally to Mars24 west).
 */
const D2R=Math.PI/180,R2D=180/Math.PI;
export const AU_KM=149597870.7,C_KMS=299792.458;

// TAI−UTC (leap seconds) since 1972; TT = TAI + 32.184 s
const LEAPS=[[1972,1,10],[1972,7,11],[1973,1,12],[1974,1,13],[1975,1,14],[1976,1,15],[1977,1,16],[1978,1,17],[1979,1,18],[1980,1,19],
  [1981,7,20],[1982,7,21],[1983,7,22],[1985,7,23],[1988,1,24],[1990,1,25],[1991,1,26],[1992,7,27],[1993,7,28],[1994,7,29],
  [1996,1,30],[1997,7,31],[1999,1,32],[2006,1,33],[2009,1,34],[2012,7,35],[2015,7,36],[2017,1,37]].map(([y,m,s])=>[Date.UTC(y,m-1,1),s]);
export function ttMinusUtc(ms){let s=10;for(const [t,v] of LEAPS)if(ms>=t)s=v;return s+32.184;}
export const julianDateUTC=ms=>2440587.5+ms/864e5;
export const julianDateTT=ms=>julianDateUTC(ms)+ttMinusUtc(ms)/86400;

/** Mars24 quantities for a UTC time (ms since 1970). */
export function marsTime(ms){
  const dt=julianDateTT(ms)-2451545.0;
  const M=((19.3870+.52402075*dt)%360+360)%360,aFMS=((270.3863+.52403840*dt)%360+360)%360;
  const A=[.0071,.0057,.0039,.0037,.0021,.0020,.0018],tau=[2.2353,2.7543,1.1177,15.7866,2.1354,2.4694,32.8493],phi=[49.409,168.173,191.837,21.736,15.704,95.528,49.095];
  let pbs=0;for(let i=0;i<7;i++)pbs+=A[i]*Math.cos((.985626*dt/tau[i]+phi[i])*D2R);
  const m=M*D2R,vM=(10.691+3e-7*dt)*Math.sin(m)+.623*Math.sin(2*m)+.05*Math.sin(3*m)+.005*Math.sin(4*m)+.0005*Math.sin(5*m)+pbs;
  const Ls=((aFMS+vM)%360+360)%360,l=Ls*D2R;
  const EOT=2.861*Math.sin(2*l)-.071*Math.sin(4*l)+.002*Math.sin(6*l)-vM; // degrees
  const MSD=(dt-4.5)/1.027491252+44796.0-.00096,MTC=((24*MSD)%24+24)%24;
  const dec=Math.asin(.42565*Math.sin(l))+.25*D2R*Math.sin(l);
  const r=1.523679*(1.00436-.09309*Math.cos(m)-.004336*Math.cos(2*m)-.00031*Math.cos(3*m)-.00003*Math.cos(4*m));
  const subsolarWest=((MTC+EOT*24/360)*15+180)%360;
  return {deltaJ2000:dt,meanAnomaly:M,Ls,equationOfTime:EOT,MSD,MTC,declination:dec*R2D,heliocentricDistance:r,subsolarLongitudeWest:subsolarWest};
}
/** Local true solar time (hours) at an east longitude. */
export function localSolarTime(ms,lonEast){
  const t=marsTime(ms),west=((360-lonEast)%360+360)%360;
  const lmst=((t.MTC-west*24/360)%24+24)%24;return ((lmst+t.equationOfTime*24/360)%24+24)%24;
}
/**
 * Sun elevation and azimuth (degrees; azimuth clockwise from north) at a site (lat, lon east),
 * and the top-of-atmosphere irradiance 1361 W/m² / r² (r in AU).
 */
export function sunPosition(ms,lat,lonEast){
  const t=marsTime(ms),ltst=localSolarTime(ms,lonEast);
  const H=(ltst-12)*15*D2R,d=t.declination*D2R,f=lat*D2R; // hour angle, positive in the afternoon
  // Sun direction in local east-north-up coordinates
  const E=-Math.cos(d)*Math.sin(H),N=Math.sin(d)*Math.cos(f)-Math.cos(d)*Math.sin(f)*Math.cos(H),U=Math.sin(d)*Math.sin(f)+Math.cos(d)*Math.cos(f)*Math.cos(H);
  return {elevation:Math.asin(Math.max(-1,Math.min(1,U)))*R2D,azimuth:(Math.atan2(E,N)*R2D+360)%360,direction:{east:E,north:N,up:U},
    irradianceTOA:1361/(t.heliocentricDistance**2),Ls:t.Ls,localSolarTime:ltst};
}
// JPL approximate planetary elements, Table 1 (1800–2050): a, e, I, L, ϖ, Ω and rates per century
const ELEMENTS={
  emb:[[1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0],[.00000562,-.00004392,-.01294668,35999.37244981,.32327364,0]],
  mars:[[1.52371034,.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],[.00001847,.00007882,-.00813131,19140.30268499,.44441088,-.29257343]],
};
/** Heliocentric ecliptic J2000 position (AU) of 'emb' (Earth–Moon barycentre) or 'mars'. */
export function heliocentric(body,ms){
  const T=(julianDateTT(ms)-2451545)/36525,[e0,r]=ELEMENTS[body],el=e0.map((x,i)=>x+r[i]*T);
  const [a,e,I,L,wbar,O]=el,w=wbar-O;let M=((L-wbar)%360+540)%360-180;
  const es=e*R2D;let E=M+es*Math.sin(M*D2R);
  for(let k=0;k<30;k++){const dM=M-(E-es*Math.sin(E*D2R)),dE=dM/(1-e*Math.cos(E*D2R));E+=dE;if(Math.abs(dE)<=1e-6)break;}
  const xp=a*(Math.cos(E*D2R)-e),yp=a*Math.sqrt(1-e*e)*Math.sin(E*D2R);
  const cw=Math.cos(w*D2R),sw=Math.sin(w*D2R),cO=Math.cos(O*D2R),sO=Math.sin(O*D2R),cI=Math.cos(I*D2R),sI=Math.sin(I*D2R);
  return [(cw*cO-sw*sO*cI)*xp+(-sw*cO-cw*sO*cI)*yp,(cw*sO+sw*cO*cI)*xp+(-sw*sO+cw*cO*cI)*yp,(sw*sI)*xp+(cw*sI)*yp];
}
/** Earth–Mars distance (AU, km) and one-way light time (s) at a UTC time. */
export function earthMarsLink(ms){
  const a=heliocentric('emb',ms),b=heliocentric('mars',ms),d=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
  return {distanceAU:d,distanceKm:d*AU_KM,oneWayLightTime:d*AU_KM/C_KMS};
}
/** Jezero crater landing site (Mars 2020): 18.44° N, 77.45° E (planetocentric). */
export const JEZERO=Object.freeze({lat:18.4447,lonEast:77.4508,label:'Jezero crater'});
