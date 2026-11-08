// Planet-layer scenarios for tools/physics-bench.mjs (--with tools/planet-bench-scenarios.mjs).
import {getDrone} from '../src/drone/DroneTypes.js';
import {PlanetFlightPhysics,PlanetPhysics,MarsEnvironment,EarthEnvironment} from '../src/planet/index.js';

const flight=(id,env,label)=>({name:`planet:${id}@${label}`,make(){
  const f=new PlanetFlightPhysics([0,30,0],0,getDrone(id),env);f.addBox([0,-.5,0],[200,.5,200]);
  f.controller.setMode('ANGLE');f.toggleArm(0);return f;
}});
export const benchScenarios=[
  flight('freestyle5',EarthEnvironment(),'earth'),
  flight('freestyle5',MarsEnvironment(),'mars'),
  flight('hex',MarsEnvironment(),'mars'),
  {name:'planet:world-8-aero-bodies@mars',make(){
    const P=new PlanetPhysics(MarsEnvironment());P.addGround();
    for(let i=0;i<8;i++)P.addBody({position:[i*2,50+i,0],velocity:[3,0,1],angularVelocity:[0,2,0],mass:1.8,
      shape:{type:'cuboid',half:[.3,.1,.3]},aero:{cdA:[.06,.12,.06],rotationalDrag:.003}});
    return {step:()=>P.step(),dispose:()=>P.dispose()};
  }},
];
