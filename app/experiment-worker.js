// Experiments run here, off the render thread: headless, faster than real time, deterministic.
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {runExperiment} from '../src/experiment/Experiment.js';
const ready=initializeRapier();
self.onmessage=async e=>{
  await ready;
  try{
    const res=runExperiment(e.data,{onProgress:(done,total,row)=>self.postMessage({type:'progress',done,total,row})});
    self.postMessage({type:'done',result:res});
  }catch(err){self.postMessage({type:'error',message:String(err?.message??err)});}
};
