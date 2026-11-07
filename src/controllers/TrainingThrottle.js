import {HOVER,FLIGHT,clamp} from '../physics/config.js';

// Vertical-speed assistance for a spring-centered gamepad. Forces still flow
// through the four motors and Rapier; this never writes position or velocity.
// `drone` (DroneTypes) supplies hover thrust and limits; without it the v0.7.0 5" values apply.
export function trainingThrottle(up,verticalSpeed,rotation,drone=null){
  const assist=drone?.assist??DEFAULT_ASSIST,hover=drone?.hover??HOVER;
  const stick=clamp(up,-1,1);
  const target=stick*(stick>=0?assist.up:assist.down);
  const acceleration=clamp((target-verticalSpeed)*assist.accel,-assist.accel,assist.accel);
  const upright=1-2*(rotation.x*rotation.x+rotation.z*rotation.z);
  return clamp(hover*(1+acceleration/FLIGHT.gravity)/Math.max(.5,upright),0,assist.cap);
}
const DEFAULT_ASSIST=Object.freeze({up:3,down:1.5,accel:4,cap:.35});
/** Manual throttle as a climb request around hover (KONUM mode with keyboard / RC throttle). */
export function throttleToVertical(throttle,hover){
  const t=clamp(throttle,0,1),band=.04;
  if(Math.abs(t-hover)<=band)return 0;
  return t>hover?clamp((t-hover-band)/Math.max(.05,(1-hover)*.5),0,1):-clamp((hover-band-t)/Math.max(.05,hover-band),0,1);
}
