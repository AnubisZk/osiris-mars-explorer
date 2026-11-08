/**
 * Lithium-ion battery pack: open-circuit voltage vs state of charge, ohmic sag, energy counting.
 *   V = S · OCV(SoC) − I · R_pack,  R_pack = S · R_cell / P
 * The current for a power demand P solves P = (V_oc − I R) I. If the demand exceeds the pack's
 * maximum power V_oc² / 4R the pack browns out (delivered power limited, flagged).
 * Temperature effects are not modelled (assumed: thermally controlled pack, as on Ingenuity).
 */
// Generic Li-ion (NMC-type) cell OCV curve, volts vs SoC (assumed typical).
export const LI_ION_OCV=Object.freeze([[0,3.0],[.05,3.3],[.1,3.45],[.2,3.55],[.4,3.65],[.6,3.8],[.8,3.95],[.9,4.05],[1,4.2]]);
const lookup=(t,x)=>{if(x<=t[0][0])return t[0][1];for(let i=1;i<t.length;i++)if(x<=t[i][0]){const [a,b]=t[i-1],[c,d]=t[i];return b+(d-b)*(x-a)/(c-a);}return t[t.length-1][1];};

export function defineBattery(spec){
  const s={series:1,parallel:1,cellResistance:.03,cellMass:.045,cutoffCellVoltage:3.0,reserve:0,ocv:LI_ION_OCV,...spec};
  const capacity=s.cellCapacityAh*s.parallel;
  const nominalEnergy=capacity*s.series*3.6;
  return Object.freeze({...s,capacityAh:capacity,nominalEnergyWh:nominalEnergy,resistance:s.series*s.cellResistance/s.parallel,
    mass:s.series*s.parallel*s.cellMass});
}

export class Battery {
  constructor(spec,soc=1){this.spec=spec;this.reset(soc);}
  reset(soc=1){this.soc=soc;this.energyUsedWh=0;this.chargeUsedAh=0;this.current=0;this.voltage=this.openCircuit();this.power=0;this.brownout=false;this.depleted=false;this.lowVoltageTime=0;}
  openCircuit(){return this.spec.series*lookup(this.spec.ocv,this.soc);}
  /** Usable energy left above the reserve SoC (Wh, at nominal voltage). */
  remainingWh(){return Math.max(0,this.soc-this.spec.reserve)*this.spec.nominalEnergyWh;}
  /** Draw `power` (W) for dt seconds; returns the terminal voltage. */
  draw(power,dt){
    const voc=this.openCircuit(),R=this.spec.resistance,pmax=voc*voc/(4*R);
    const p=Math.max(0,Math.min(power,.999*pmax));this.brownout=power>p+1e-9;
    const I=p>0?(voc-Math.sqrt(voc*voc-4*R*p))/(2*R):0;
    this.current=I;this.voltage=voc-I*R;this.power=p;
    this.chargeUsedAh+=I*dt/3600;this.energyUsedWh+=p*dt/3600;
    this.soc=Math.max(0,this.soc-I*dt/3600/this.spec.capacityAh);
    // low-voltage cutoff only after 1 s below the limit (transient sag during spin-up is normal)
    this.lowVoltageTime=this.voltage<this.spec.cutoffCellVoltage*this.spec.series?this.lowVoltageTime+dt:0;
    this.depleted=this.soc<=this.spec.reserve||this.lowVoltageTime>1;
    return this.voltage;
  }
}
